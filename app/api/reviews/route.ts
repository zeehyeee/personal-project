import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { poolId, content, rating, visitedAt, tags, password } = body;

  if (!poolId || !content || !rating || !password) {
    return NextResponse.json({ error: "필수 항목을 입력해주세요." }, { status: 400 });
  }

  const passwordHash = await hashPassword(password);

  const review = await prisma.review.create({
    data: {
      poolId,
      content,
      rating: parseInt(rating),
      visitedAt: visitedAt ? new Date(visitedAt) : null,
      tags: JSON.stringify(tags ?? []),
      passwordHash,
    },
    select: {
      id: true, content: true, rating: true,
      visitedAt: true, tags: true, createdAt: true,
    },
  });

  return NextResponse.json(review, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const { id, password } = await req.json();

  const review = await prisma.review.findUnique({ where: { id } });
  if (!review) return NextResponse.json({ error: "리뷰를 찾을 수 없습니다." }, { status: 404 });

  const ok = await verifyPassword(password, review.passwordHash);
  if (!ok) return NextResponse.json({ error: "비밀번호가 틀렸습니다." }, { status: 403 });

  await prisma.review.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
