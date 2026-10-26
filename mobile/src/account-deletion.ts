type DeletionSteps={
 queued:()=>Promise<boolean>;markRequested:()=>Promise<void>;begin:()=>Promise<void>;markQueued:()=>Promise<void>;
 cleanDevice:()=>Promise<void>;signOut:()=>Promise<void>;receipt:()=>Promise<void>;
};
// A queued server deletion remains durable even after its Auth user disappears.
export async function deleteAccountData(steps:DeletionSteps){
 if(!await steps.queued()){await steps.markRequested();await steps.begin();await steps.markQueued();}
 await steps.cleanDevice();await steps.signOut();await steps.receipt();
}
