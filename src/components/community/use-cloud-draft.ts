'use client';
import {useEffect,useRef,useState,type SetStateAction} from 'react';
import {useCommunitySession} from './community-session';
import {memberAction} from '@/lib/member-client';

export function useCloudDraft<T extends object>(kind:'discussion'|'column',initial:()=>T,editing=false) {
  const {user,requestLogin}=useCommunitySession();
  const [draft,updateDraft]=useState(initial);
  const [saved,setSaved]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState('');
  const [loadedUser,setLoadedUser]=useState<string|null>(null);
  const revision=useRef(0);
  const owner=useRef(user?.id);
  const loading=!!user&&!editing&&loadedUser!==user.id;
  function setDraft(value:SetStateAction<T>) {revision.current++;setSaved(false);updateDraft(value);}
  useEffect(()=>{
    if(!user||editing) return;
    const controller=new AbortController();
    const userId=user.id, version=revision.current;
    fetch(`/api/member-data?kind=${kind}`,{cache:'no-store',signal:controller.signal}).then(async response=>{
      const result=await response.json();
      if(!response.ok) throw new Error(result.error);
      if(controller.signal.aborted) return;
      if(revision.current===version && (version===0 || (owner.current && owner.current!==userId))) {
        updateDraft(result.draft?.payload ?? initial());
        setSaved(!!result.draft);
      }
      owner.current=userId;setLoadedUser(userId);setError('');
    }).catch(failure=>{if(!controller.signal.aborted){setError(failure.message||'無法載入雲端草稿。');setLoadedUser(userId);}});
    return ()=>controller.abort();
    // initial describes this editor instance; it must not reload while typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[user?.id,editing,kind]);
  async function saveDraft(){
    if(!user){requestLogin();return;}
    const version=revision.current;
    setSaving(true);setError('');
    try{await memberAction('saveDraft',{kind,payload:draft});if(version===revision.current)setSaved(true);}
    catch(failure){setError(failure instanceof Error?failure.message:'無法儲存雲端草稿。');}
    finally{setSaving(false);}
  }
  async function clearDraft(){await memberAction('deleteDraft',{kind});setSaved(false);}
  return {draft,setDraft,saved,setSaved,saving,loading,error,saveDraft,clearDraft};
}
