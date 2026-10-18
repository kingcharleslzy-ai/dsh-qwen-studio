import {createHash} from 'node:crypto';
import type {Job} from './shared.js';
/** Bounded revision history supports multiple tabs without sending the full library per step. */
export class GallerySnapshots {
  private versions=new Map<string,Map<string,string>>();
  project(jobs:Job[],prior:string|null){
    const encoded=new Map(jobs.map(j=>[j.id,JSON.stringify(j)]));
    const revision=createHash('sha256').update(JSON.stringify([...encoded])).digest('hex');
    const old=prior?this.versions.get(prior):undefined;
    if(!this.versions.has(revision)){
      this.versions.set(revision,encoded);
      if(this.versions.size>16)this.versions.delete(this.versions.keys().next().value!);
    }
    if(prior===revision)return {jobsRevision:revision};
    if(!old)return {jobsRevision:revision,jobs};
    return {jobsRevision:revision,jobChanges:jobs.filter(j=>old.get(j.id)!==encoded.get(j.id)),removedJobIds:[...old.keys()].filter(id=>!encoded.has(id))};
  }
}
