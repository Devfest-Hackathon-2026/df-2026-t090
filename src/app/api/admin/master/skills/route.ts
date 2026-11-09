import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { getAdminDb, FieldValue } from "@/lib/firebase-admin";
import { recordAuditLog } from "@/lib/audit-logger";

/**
 * GET /api/admin/master/skills
 * スキル分野およびスキルマスターの一覧取得
 */
export async function GET(request: Request) {
  const guard = await requireAdmin(request);
  if ("response" in guard) {
    return guard.response;
  }

  try {
    const db = getAdminDb();

    // 1. 分野一覧
    const catSnapshot = await db.collection("skills_categories").orderBy("order", "asc").get();
    const categories = catSnapshot.docs.map((doc) => ({
      id: doc.id,
      name: doc.data().name || "",
      order: doc.data().order || 0,
      skillsCount: 0,
    }));

    // 2. スキルマスター一覧
    const skillsSnapshot = await db.collection("skills_master").get();
    const skills = skillsSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        categoryId: data.categoryId || "",
        categoryName: data.categoryName || "",
        name: data.name || "",
        aliases: Array.isArray(data.aliases) ? data.aliases : [],
        levelType: data.levelType || "level",
        hasLevels: Boolean(data.hasLevels),
        requiredEvidencePrompt: data.requiredEvidencePrompt || "",
        status: data.status || "active", // active または disabled
        holdersCount: data.holdersCount || 0,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : null,
      };
    });

    // 分野ごとのスキル件数を集計
    for (const cat of categories) {
      cat.skillsCount = skills.filter((s) => s.categoryId === cat.id).length;
    }

    return NextResponse.json({
      categories,
      skills,
    });
  } catch (error) {
    console.error("スキルマスター取得エラー:", error);
    return NextResponse.json({ error: "スキルマスターの取得に失敗しました。" }, { status: 500 });
  }
}

/**
 * POST /api/admin/master/skills
 * 分野の新規追加、スキルの新規追加・編集・無効化
 * 仕様厳守: 「スキルは消せない。選べなくしても、すでに持っている人の枝は残る。名前を変えても付いている枝はそのまま引き継ぐ」
 */
export async function POST(request: Request) {
  const guard = await requireAdmin(request);
  if ("response" in guard) {
    return guard.response;
  }

  const currentAdmin = guard.user;

  try {
    const body = await request.json();
    const { action } = body;
    const db = getAdminDb();

    // 1. 分野の追加
    if (action === "create_category") {
      const name = (body.name || "").trim();
      if (!name) {
        return NextResponse.json({ error: "分野名を入力してください。" }, { status: 400 });
      }

      const catRef = db.collection("skills_categories").doc();
      const order = Number(body.order) || 99;

      await catRef.set({
        name,
        order,
        createdAt: FieldValue.serverTimestamp(),
      });

      await recordAuditLog({
        adminUid: currentAdmin.uid,
        adminName: currentAdmin.displayName,
        adminEmail: currentAdmin.email,
        actionType: "master_skill_edit",
        actionDetail: `新しいスキル分野「${name}」を追加しました`,
        targetType: "skill_category",
        targetId: catRef.id,
        targetName: name,
        reasonAndNotes: body.reason || "分野の新規作成",
      });

      return NextResponse.json({ message: "分野を追加しました。", id: catRef.id });
    }

    // 2. スキルの追加
    if (action === "create_skill") {
      const { categoryId, categoryName, name, aliases, levelType, hasLevels, requiredEvidencePrompt } = body;

      if (!categoryId || !name) {
        return NextResponse.json({ error: "必須項目が不足しています。" }, { status: 400 });
      }

      const skillRef = db.collection("skills_master").doc();
      const cleanAliases = Array.isArray(aliases)
        ? aliases.map((a: string) => a.trim()).filter(Boolean)
        : (aliases || "").split(",").map((s: string) => s.trim()).filter(Boolean);

      await skillRef.set({
        categoryId,
        categoryName: categoryName || "",
        name: name.trim(),
        aliases: cleanAliases,
        levelType: levelType || "level",
        hasLevels: Boolean(hasLevels),
        requiredEvidencePrompt: (requiredEvidencePrompt || "").trim(),
        status: "active",
        holdersCount: 0,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      await recordAuditLog({
        adminUid: currentAdmin.uid,
        adminName: currentAdmin.displayName,
        adminEmail: currentAdmin.email,
        actionType: "master_skill_edit",
        actionDetail: `新しいスキル「${name}」を追加しました`,
        targetType: "skill",
        targetId: skillRef.id,
        targetName: name,
        reasonAndNotes: body.reason || "スキルの新規登録",
      });

      return NextResponse.json({ message: "スキルを追加しました。", id: skillRef.id });
    }

    // 3. スキルの編集・ステータス変更（選べなくする）
    if (action === "update_skill") {
      const { skillId, name, aliases, levelType, hasLevels, requiredEvidencePrompt, status, reason } = body;

      if (!skillId) {
        return NextResponse.json({ error: "スキルIDが指定されていません。" }, { status: 400 });
      }

      const skillRef = db.collection("skills_master").doc(skillId);
      const existingDoc = await skillRef.get();

      if (!existingDoc.exists) {
        return NextResponse.json({ error: "対象のスキルが存在しません。" }, { status: 404 });
      }

      const existingData = existingDoc.data();
      const oldName = existingData?.name || "";
      const newName = (name || oldName).trim();

      const updateData: Record<string, unknown> = {
        updatedAt: FieldValue.serverTimestamp(),
      };

      if (name) updateData.name = newName;
      if (aliases !== undefined) {
        updateData.aliases = Array.isArray(aliases)
          ? aliases.map((a: string) => a.trim()).filter(Boolean)
          : (aliases || "").split(",").map((s: string) => s.trim()).filter(Boolean);
      }
      if (levelType) updateData.levelType = levelType;
      if (hasLevels !== undefined) updateData.hasLevels = Boolean(hasLevels);
      if (requiredEvidencePrompt !== undefined) updateData.requiredEvidencePrompt = requiredEvidencePrompt;
      if (status) updateData.status = status; // "active" | "disabled"

      await skillRef.update(updateData);

      // ★仕様書の絶対ルール: 「名前を変えても、付いている枝はそのまま引き継ぐ」
      // 名前が変更された場合は、既存のユーザーの枝（user_skills）のskillNameも引き継ぎ更新
      if (newName !== oldName) {
        const branchesSnapshot = await db
          .collection("user_skills")
          .where("skillId", "==", skillId)
          .get();

        const batch = db.batch();
        for (const bDoc of branchesSnapshot.docs) {
          batch.update(bDoc.ref, { skillName: newName });
        }
        await batch.commit();
      }

      await recordAuditLog({
        adminUid: currentAdmin.uid,
        adminName: currentAdmin.displayName,
        adminEmail: currentAdmin.email,
        actionType: "master_skill_edit",
        actionDetail: `スキル「${oldName}」の定義を更新しました${status === "disabled" ? "（選べない状態に変更）" : ""}`,
        targetType: "skill",
        targetId: skillId,
        targetName: newName,
        reasonAndNotes: reason || "スキルの定期メンテナンス",
      });

      return NextResponse.json({ message: "スキルを更新しました。" });
    }

    return NextResponse.json({ error: "無効なアクションです。" }, { status: 400 });
  } catch (error) {
    console.error("スキル更新エラー:", error);
    return NextResponse.json({ error: "処理中にエラーが発生しました。" }, { status: 500 });
  }
}
