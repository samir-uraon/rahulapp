import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import clientPromise from "@/lib/mongodb";

export const authOptions = {
  providers: [
    // GOOGLE LOGIN
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),

    // EMAIL / PHONE + PASSWORD LOGIN
    Credentials({
      name: "Credentials",

      credentials: {
        identifier: {
          label: "Email or Phone",
          type: "text",
        },
        password: {
          label: "Password",
          type: "password",
        },
      },

      async authorize(credentials) {
        if (!credentials?.identifier || !credentials?.password) {
          return null;
        }

        try {
          const client = await clientPromise;
          const db = client.db("rahul");
          const users = db.collection("users");

          const identifier = credentials.identifier.trim();

          const user = await users.findOne({
            $or: [
              { email: identifier.toLowerCase() },
              { phone: identifier },
            ],
          });

          if (!user || !user.password) {
            return null;
          }

          const passwordMatch = await bcrypt.compare(
            credentials.password,
            user.password
          );

          if (!passwordMatch) {
            return null;
          }

          // VERIFY ACCOUNT
          if (user.isVerified !== true) {
            if (
              user.deleteAt &&
              new Date() >= new Date(user.deleteAt)
            ) {
              await users.deleteOne({
                _id: user._id,
                isVerified: false,
              });

              throw new Error("ACCOUNT_EXPIRED");
            }

            throw new Error("EMAIL_NOT_VERIFIED");
          }

          return {
            id: user._id.toString(),
            name: user.name,
            email: user.email,
            phone: user.phone || "",

            // LOCATION DETAILS
            location: user.address || user.locationName || "",
            locationName: user.locationName || "",
            address: user.address || "",
            latitude: user.location?.latitude ?? user.latitude ?? null,
            longitude: user.location?.longitude ?? user.longitude ?? null,
          };
        } catch (error) {
          console.error("Authentication error:", error);

          if (
            error.message === "EMAIL_NOT_VERIFIED" ||
            error.message === "ACCOUNT_EXPIRED"
          ) {
            throw error;
          }

          return null;
        }
      },
    }),
  ],

  session: {
    strategy: "jwt",
  },

  callbacks: {
    // GOOGLE LOGIN
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        try {
          const client = await clientPromise;
          const db = client.db(process.env.MONGODB);
          const users = db.collection("users");

          const email = user.email?.toLowerCase();

          if (!email) {
            return false;
          }

          const existingUser = await users.findOne({ email });

          if (existingUser) {
            user.id = existingUser._id.toString();
            user.name = existingUser.name;
            user.email = existingUser.email;
            user.phone = existingUser.phone || "";

            // EXISTING USER LOCATION
            user.location = existingUser.address || existingUser.locationName || "";
            user.locationName = existingUser.locationName || "";
            user.address = existingUser.address || "";
            user.latitude =
              existingUser.location?.latitude ??
              existingUser.latitude ??
              null;
            user.longitude =
              existingUser.location?.longitude ??
              existingUser.longitude ??
              null;

            return true;
          }

          // CREATE NEW GOOGLE USER
          const result = await users.insertOne({
            name: user.name,
            email,
            phone: "",
            password: null,
            isVerified: true,

            locationName: "",
            address: "",
            location: {
              latitude: null,
              longitude: null,
            },

            createdAt: new Date(),
          });

          user.id = result.insertedId.toString();
          user.email = email;
          user.phone = "";

          user.location = "";
          user.locationName = "";
          user.address = "";
          user.latitude = null;
          user.longitude = null;

          return true;
        } catch (error) {
          console.error("Google authentication error:", error);
          return false;
        }
      }

      return true;
    },

    // JWT CALLBACK
    async jwt({ token, user, trigger, session }) {
      // INITIAL LOGIN
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.email = user.email;
        token.phone = user.phone || "";

        token.location = user.location || "";
        token.locationName = user.locationName || "";
        token.address = user.address || "";
        token.latitude = user.latitude ?? null;
        token.longitude = user.longitude ?? null;
      }

      // SESSION UPDATE
      if (trigger === "update" && session) {
        if (session.name !== undefined) {
          token.name = session.name;
        }

        if (session.phone !== undefined) {
          token.phone = session.phone;
        }

        if (session.locationName !== undefined) {
          token.locationName = session.locationName;
        }

        if (session.address !== undefined) {
          token.address = session.address;
        }

        if (session.latitude !== undefined) {
          token.latitude = session.latitude;
        }

        if (session.longitude !== undefined) {
          token.longitude = session.longitude;
        }

        // Backward compatibility
        if (session.location !== undefined) {
          token.location = session.location;
        } else if (
          session.address !== undefined ||
          session.locationName !== undefined
        ) {
          token.location =
            session.address || session.locationName || "";
        }
      }

      return token;
    },

    // SESSION CALLBACK
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.name = token.name;
        session.user.email = token.email;
        session.user.phone = token.phone || "";

        session.user.location = token.location || "";
        session.user.locationName = token.locationName || "";
        session.user.address = token.address || "";
        session.user.latitude = token.latitude ?? null;
        session.user.longitude = token.longitude ?? null;
      }

      return session;
    },
  },

  pages: {
    signIn: "/login",
  },

  secret: process.env.AUTH_SECRET,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };