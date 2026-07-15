import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { uploadFileToS3 } from "@/lib/s3"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest) {
  const session = await auth()

  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const formData = await req.formData()
  const file = formData.get("file") as File | null

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const logoUrl = await uploadFileToS3(buffer, file.name, file.type)

  await prisma.company.update({
    where: { id: session.user.companyId },
    data: { logoUrl },
  })

  return NextResponse.json({ logoUrl })
}