import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

interface RolePermissions {
  settingsSections?: { approvalWorkflows?: boolean }
}

async function hasApprovalWorkflowsPermission(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: true },
  })
  const permissions = user?.role?.permissions as RolePermissions | undefined
  return !!permissions?.settingsSections?.approvalWorkflows
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }
  if (!(await hasApprovalWorkflowsPermission(session.user.id))) {
    return NextResponse.json({ error: "You don't have permission to edit approval workflows" }, { status: 403 })
  }

  const { id } = await params
  const existing = await prisma.approvalWorkflow.findUnique({
    where: { id, companyId: session.user.companyId },
  })
  if (!existing) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 })
  }

  const body = await req.json()

  const data: Record<string, unknown> = {}
  if (body.name !== undefined) data.name = body.name
  if (body.active !== undefined) data.active = Boolean(body.active)
  if (body.triggerType !== undefined) data.triggerType = body.triggerType
  if (body.thresholdValue !== undefined) {
    data.thresholdValue = body.thresholdValue != null ? Number(body.thresholdValue) : null
  }
  if (body.triggerUserId !== undefined) data.triggerUserId = body.triggerUserId || null
  if (body.requiredRoleId !== undefined) data.requiredRoleId = body.requiredRoleId

  const workflow = await prisma.approvalWorkflow.update({ where: { id }, data })

  return NextResponse.json(workflow)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }
  if (!(await hasApprovalWorkflowsPermission(session.user.id))) {
    return NextResponse.json({ error: "You don't have permission to delete approval workflows" }, { status: 403 })
  }

  const { id } = await params
  const existing = await prisma.approvalWorkflow.findUnique({
    where: { id, companyId: session.user.companyId },
  })
  if (!existing) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 })
  }

  await prisma.approvalWorkflow.delete({ where: { id } })

  return NextResponse.json({ deleted: true })
}