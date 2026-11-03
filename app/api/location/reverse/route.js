
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    const lat = Number(searchParams.get("lat"));
    const lon = Number(searchParams.get("lon"));

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      lat < -90 ||
      lat > 90 ||
      lon < -180 ||
      lon > 180
    ) {
      return NextResponse.json(
        { message: "Invalid latitude or longitude." },
        { status: 400 }
      );
    }

    const url = new URL(
      "https://nominatim.openstreetmap.org/reverse"
    );

    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lon));
    url.searchParams.set("addressdetails", "1");

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "Zeriy/1.0 (location-service)",
      },
      signal: AbortSignal.timeout(12000),
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();

      console.error("Nominatim API Error:", {
        status: response.status,
        response: errorText,
      });

      return NextResponse.json(
        {
          message: "Unable to resolve the address.",
          providerStatus: response.status,
        },
        { status: 502 }
      );
    }

    const result = await response.json();

    if (!result.display_name) {
      return NextResponse.json(
        { message: "Address not found." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        display_name: result.display_name,
        address: result.address || {},
        lat: result.lat,
        lon: result.lon,
      },
      {
        headers: {
          "Cache-Control": "private, max-age=300",
        },
      }
    );
  } catch (error) {
    console.error("Reverse geocoding error:", error);

    return NextResponse.json(
      {
        message: "Reverse geocoding service unavailable.",
      },
      { status: 500 }
    );
  }
}
