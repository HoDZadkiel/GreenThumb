export async function memberAction(action:string,fields:object={}) {
  const response=await fetch('/api/member-data',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...fields,action})});
  const result=await response.json();
  if(!response.ok) throw new Error(result.error || '無法儲存會員資料。');
  return result;
}
