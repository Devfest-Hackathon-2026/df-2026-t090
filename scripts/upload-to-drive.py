#!/usr/bin/env python3
"""
HIVE 開発ログを Google Drive に自動アップロード・コピーするスクリプト
- Google Drive上に「HIVE_開発ドキュメント」フォルダを自動作成・特定
- 対象のMarkdown/テキストファイルをGoogle Driveへアップロード
"""

import sys
import os
import json
import subprocess
import urllib.request
import urllib.error

PROJECT_ID = "project-7f11774d-0f3a-4228-93f"
FOLDER_NAME = "HIVE_開発ドキュメント"

def get_access_token():
    cmd = ["gcloud", "auth", "print-access-token"]
    return subprocess.check_output(cmd).decode().strip()

def drive_api_request(url, method="GET", data=None, headers=None):
    token = get_access_token()
    req_headers = {
        "Authorization": f"Bearer {token}",
        "X-Goog-User-Project": PROJECT_ID,
    }
    if headers:
        req_headers.update(headers)
    
    req = urllib.request.Request(url, data=data, headers=req_headers, method=method)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())

def get_or_create_folder(folder_name):
    # 既存フォルダの検索
    q = f"name = '{folder_name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
    url = f"https://www.googleapis.com/drive/v3/files?q={urllib.parse.quote(q)}"
    res = drive_api_request(url)
    files = res.get("files", [])
    if files:
        print(f"📁 既存のフォルダを使用します: {folder_name} (ID: {files[0]['id']})")
        return files[0]["id"]
    
    # 新規フォルダの作成
    create_url = "https://www.googleapis.com/drive/v3/files"
    meta = {
        "name": folder_name,
        "mimeType": "application/vnd.google-apps.folder"
    }
    res = drive_api_request(
        create_url,
        method="POST",
        data=json.dumps(meta).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    folder_id = res["id"]
    print(f"📁 Google Driveに新規フォルダを作成しました: {folder_name} (ID: {folder_id})")
    return folder_id

def upload_file(local_path, folder_id):
    filename = os.path.basename(local_path)
    with open(local_path, "rb") as f:
        file_bytes = f.read()

    metadata = {
        "name": filename,
        "parents": [folder_id],
    }

    boundary = "-------314159265358979323846"
    body = bytearray()
    
    # 1. メタデータパート
    body.extend(f"--{boundary}\r\n".encode("utf-8"))
    body.extend(b"Content-Type: application/json; charset=UTF-8\r\n\r\n")
    body.extend(json.dumps(metadata).encode("utf-8"))
    body.extend(b"\r\n")

    # 2. メディアパート (Markdown / テキスト)
    body.extend(f"--{boundary}\r\n".encode("utf-8"))
    body.extend(b"Content-Type: text/markdown; charset=UTF-8\r\n\r\n")
    body.extend(file_bytes)
    body.extend(b"\r\n")
    body.extend(f"--{boundary}--\r\n".encode("utf-8"))

    upload_url = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart"
    headers = {
        "Content-Type": f"multipart/related; boundary={boundary}",
        "Content-Length": str(len(body)),
    }

    res = drive_api_request(upload_url, method="POST", data=bytes(body), headers=headers)
    file_id = res.get("id")
    print(f"✅ アップロード完了！")
    print(f"   ファイル名: {filename}")
    print(f"   Google Drive ID: {file_id}")
    print(f"   リンク: https://drive.google.com/file/d/{file_id}/view")
    return file_id

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 upload-to-drive.py <file_path>")
        sys.exit(1)
    
    target_file = sys.argv[1]
    if not os.path.exists(target_file):
        print(f"Error: File not found: {target_file}")
        sys.exit(1)

    print("🚀 Google Driveへの同期を開始します...")
    folder_id = get_or_create_folder(FOLDER_NAME)
    upload_file(target_file, folder_id)
