import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const laneLength = searchParams.get("laneLength");
  const kickboard = searchParams.get("kickboard");
  const district = searchParams.get("district");

  const pools = await prisma.pool.findMany({
    where: {
      ...(laneLength ? { laneLength: parseInt(laneLength) } : {}),
      ...(kickboard === "true" ? { kickboard: true } : {}),
      ...(district ? { address: { contains: district } } : {}),
    },
    include: {
      _count: { select: { reviews: true } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(pools);
}
