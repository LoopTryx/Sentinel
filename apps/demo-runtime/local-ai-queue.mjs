// A console Stop action owns console jobs only. Automatic message screening
// shares the CPU but cannot be cancelled by an unrelated chat's button.
export function createLocalQueue(ai){
 const jobs=new Set();let tail=Promise.resolve(),active=null,closed=false;
 return {
  run(question,finding,options={}){
   if(closed)return Promise.reject(Error('local_model_unavailable'));
   if(jobs.size>=8)return Promise.reject(Error('local_model_busy'));
   const job={console:!options.classification,cancelled:false};jobs.add(job);
   const result=tail.then(async()=>{if(job.cancelled||closed)throw Error('local_cancelled_or_timed_out');active=job;try{const answer=await ai.answer(question,finding,options);if(job.cancelled||closed)throw Error('local_cancelled_or_timed_out');return answer;}finally{active=null;}});
   tail=result.catch(()=>{});return result.finally(()=>jobs.delete(job));
  },
  cancelConsole(){for(const job of jobs)if(job.console)job.cancelled=true;if(active?.console)ai.cancel();},
  close(){closed=true;for(const job of jobs)job.cancelled=true;ai.cancel();}
 };
}
