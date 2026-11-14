import { notifyMemberSessionChange } from './member-session-store.mjs';

export async function memberRequest(path: string, fields: object, expectedUserId: string | null) {
  const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...fields, expectedUserId }) })
    .catch(() => { throw new Error('無法連線，請稍後再試。'); });
  const result = await response.json().catch(() => { throw new Error('伺服器暫時無法處理請求。'); });
  if (response.status === 401 || response.status === 409) notifyMemberSessionChange();
  if (!response.ok) throw new Error(result.error || '無法儲存會員資料。');
  return result;
}

export function memberAction(action: string, fields: object, expectedUserId: string) {
  return memberRequest('/api/member-data', { ...fields, action }, expectedUserId);
}
