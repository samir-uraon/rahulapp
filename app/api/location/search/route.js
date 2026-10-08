import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    const query = searchParams.get("q");

    if (!query || !query.trim()) {
      return NextResponse.json([]);
    }

    const url =
      `https://nominatim.openstreetmap.org/search` +
      `?format=jsonv2` +
      `&addressdetails=1` +
      `&limit=5` +
      `&countrycodes=in` +
      `&q=${encodeURIComponent(query.trim())}`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "QueueEase/1.0",
        "Accept-Language": "en",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Location search failed" },
        { status: 500 }
      );
    }

    const data = await response.json();

    const results = data.map((item) => ({
      placeId: item.place_id,
      name: item.name || item.display_name,
      address: item.display_name,
      latitude: Number(item.lat),
      longitude: Number(item.lon),
    }));

    return NextResponse.json(results);
  } catch (error) {
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}