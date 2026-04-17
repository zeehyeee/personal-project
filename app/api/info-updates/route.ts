import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { poolId, fieldName, newValue, description, password } = body;

  if (!poolId || !fieldName || !newValue || !password) {
    return NextResponse.json({ error: "필수 항목을 입력해주세요." }, { status: 400 });
  }

  const passwordHash = await hashPassword(password);

  const update = await prisma.infoUpdate.create({
    data: { poolId, fieldName, newValue, description, passwordHash },
    select: { id: true, fieldName: true, newValue: true, description: true, status: true, createdAt: true },
  });

  return NextResponse.json(update, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const { id, password } = await req.json();

  const update = await prisma.infoUpdate.findUnique({ where: { id } });
  if (!update) return NextResponse.json({ error: "정보를 찾을 수 없습니다." }, { status: 404 });

  const ok = await verifyPassword(password, update.passwordHash);
  if (!ok) return NextResponse.json({ error: "비밀번호가 틀렸습니다." }, { status: 403 });

  await prisma.infoUpdate.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
