import { NextResponse } from "next/server";
import { authenticate } from "@/lib/auth";
import { getAdminDb, FieldValue } from "@/lib/firebase-admin";
import { MemberEvaluation, EvaluationSummary } from "@/lib/types/hive";

/**
 * GET /api/student/evaluations
 * 1. ?targetUid=... : 特定ユーザーが受け取った評価一覧と平均集計
 * 2. ?projectId=... : 該当プロジェクト内で自分が相手に行った評価一覧
 * 3. ?summaryUids=uid1,uid2,... : 複数ユーザーの平均星を一括集計（メンバー一覧カード用）
 */
export async function GET(request: Request) {
  const authUser = await authenticate(request);
  if (!authUser) {
    return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const targetUid = searchParams.get("targetUid");
  const projectId = searchParams.get("projectId");
  const summaryUidsStr = searchParams.get("summaryUids");

  try {
    const db = getAdminDb();

    // 複数ユーザーの平均星を一括集計して返す
    if (summaryUidsStr) {
      const uids = summaryUidsStr.split(",").filter(Boolean);
      const summaries: Record<string, { averageOverall: number; count: number }> = {};

      for (const uid of uids) {
        const snap = await db
          .collection("evaluations")
          .where("toUid", "==", uid)
          .get();

        if (snap.empty) {
          summaries[uid] = { averageOverall: 0, count: 0 };
        } else {
          let sumOverall = 0;
          snap.docs.forEach((doc) => {
            const data = doc.data();
            const sc = data.scores || {};
            const avg =
              ((sc.contribution || 0) +
                (sc.trust || 0) +
                (sc.cooperation || 0) +
                (sc.sharing || 0)) /
              4;
            sumOverall += avg;
          });
          const avgOverall = Math.round((sumOverall / snap.size) * 10) / 10;
          summaries[uid] = { averageOverall: avgOverall, count: snap.size };
        }
      }

      return NextResponse.json({ summaries });
    }

    // 特定プロジェクトで自分が送った評価一覧
    if (projectId) {
      const snap = await db
        .collection("evaluations")
        .where("projectId", "==", projectId)
        .where("fromUid", "==", authUser.uid)
        .get();

      const mySentEvaluations = snap.docs.map((doc) => doc.data());
      return NextResponse.json({ evaluations: mySentEvaluations });
    }

    // 特定ユーザー（未指定時は自分）が受け取った評価一覧と詳細集計
    const uidToSearch = targetUid || authUser.uid;
    const snapshot = await db
      .collection("evaluations")
      .where("toUid", "==", uidToSearch)
      .get();

    if (snapshot.empty) {
      const emptySummary: EvaluationSummary = {
        averageOverall: 0,
        contributionAvg: 0,
        trustAvg: 0,
        cooperationAvg: 0,
        sharingAvg: 0,
        count: 0,
      };
      return NextResponse.json({ evaluations: [], summary: emptySummary });
    }

    let totalContribution = 0;
    let totalTrust = 0;
    let totalCooperation = 0;
    let totalSharing = 0;

    const evaluations: MemberEvaluation[] = snapshot.docs.map((doc) => {
      const data = doc.data();
      const sc = data.scores || {};
      const contribution = Number(sc.contribution) || 3;
      const trust = Number(sc.trust) || 3;
      const cooperation = Number(sc.cooperation) || 3;
      const sharing = Number(sc.sharing) || 3;

      totalContribution += contribution;
      totalTrust += trust;
      totalCooperation += cooperation;
      totalSharing += sharing;

      return {
        id: doc.id,
        projectId: data.projectId,
        projectTitle: data.projectTitle || "共創プロジェクト",
        fromUid: data.fromUid,
        fromName: data.fromName || "メンバー",
        toUid: data.toUid,
        toName: data.toName || "メンバー",
        scores: {
          contribution,
          trust,
          cooperation,
          sharing,
        },
        comment: data.comment || "",
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : new Date().toISOString(),
      };
    });

    const count = evaluations.length;
    const contributionAvg = Math.round((totalContribution / count) * 10) / 10;
    const trustAvg = Math.round((totalTrust / count) * 10) / 10;
    const cooperationAvg = Math.round((totalCooperation / count) * 10) / 10;
    const sharingAvg = Math.round((totalSharing / count) * 10) / 10;
    const averageOverall =
      Math.round(
        ((contributionAvg + trustAvg + cooperationAvg + sharingAvg) / 4) * 10
      ) / 10;

    const summary: EvaluationSummary = {
      averageOverall,
      contributionAvg,
      trustAvg,
      cooperationAvg,
      sharingAvg,
      count,
    };

    return NextResponse.json({ evaluations, summary });
  } catch (error) {
    console.error("相互評価取得エラー:", error);
    return NextResponse.json({ error: "相互評価の取得に失敗しました。" }, { status: 500 });
  }
}

/**
 * POST /api/student/evaluations
 * 終了プロジェクトの相手メンバーに対する相互評価の保存・更新
 */
export async function POST(request: Request) {
  const authUser = await authenticate(request);
  if (!authUser) {
    return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { projectId, toUid, scores, comment = "" } = body;

    if (!projectId || !toUid || !scores) {
      return NextResponse.json({ error: "必須項目が不足しています。" }, { status: 400 });
    }

    // 自分自身への評価は不可
    if (authUser.uid === toUid) {
      return NextResponse.json({ error: "自分自身を評価することはできません。" }, { status: 400 });
    }

    // スコアの範囲検証 (1〜5)
    const contribution = Math.min(5, Math.max(1, Math.round(Number(scores.contribution) || 3)));
    const trust = Math.min(5, Math.max(1, Math.round(Number(scores.trust) || 3)));
    const cooperation = Math.min(5, Math.max(1, Math.round(Number(scores.cooperation) || 3)));
    const sharing = Math.min(5, Math.max(1, Math.round(Number(scores.sharing) || 3)));

    const db = getAdminDb();

    // プロジェクト情報の取得と終了確認
    const pjDoc = await db.collection("ideas").doc(projectId).get();
    if (!pjDoc.exists) {
      return NextResponse.json({ error: "指定されたプロジェクトが存在しません。" }, { status: 404 });
    }
    const pjData = pjDoc.data();
    const projectTitle = pjData?.result?.title || pjData?.title || "プロジェクト";

    // 評価者の情報
    const senderUserDoc = await db.collection("users").doc(authUser.uid).get();
    const senderName = senderUserDoc.data()?.displayName || "メンバー";

    // 被評価者の情報
    const targetUserDoc = await db.collection("users").doc(toUid).get();
    const targetName = targetUserDoc.data()?.displayName || "メンバー";

    // ドキュメントID: projectId_fromUid_toUid で一意に管理（再評価・修正可）
    const evalId = `${projectId}_${authUser.uid}_${toUid}`;
    const evalRef = db.collection("evaluations").doc(evalId);

    const docSnap = await evalRef.get();
    const isNew = !docSnap.exists;

    await evalRef.set(
      {
        projectId,
        projectTitle,
        fromUid: authUser.uid,
        fromName: senderName,
        toUid,
        toName: targetName,
        scores: {
          contribution,
          trust,
          cooperation,
          sharing,
        },
        comment: (comment || "").trim(),
        updatedAt: FieldValue.serverTimestamp(),
        ...(isNew ? { createdAt: FieldValue.serverTimestamp() } : {}),
      },
      { merge: true }
    );

    return NextResponse.json({
      message: isNew ? "相互評価を登録しました。" : "相互評価を更新しました。",
      evalId,
    });
  } catch (error) {
    console.error("相互評価送信エラー:", error);
    return NextResponse.json({ error: "相互評価の送信に失敗しました。" }, { status: 500 });
  }
}
