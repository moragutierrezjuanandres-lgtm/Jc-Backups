package service

import (
 "testing"
 "time"

 "jcevnzl/backup-agent/internal/runner"
)

func TestOccurrenceKeyIsStable(t *testing.T){
 p:=runner.Policy{Revision:4,Days:[]int{6},Time:"10:00",Timezone:"America/Caracas"}
 a,_:=time.Parse(time.RFC3339,"2026-09-26T15:00:00Z")
 key,ok:=latestOccurrence(p,a);if !ok||key!="scheduled:4:2026-09-26:10:00"{t.Fatalf("bad occurrence %q %t",key,ok)}
 key2,ok:=latestOccurrence(p,a.Add(20*time.Minute));if !ok||key2!=key{t.Fatalf("duplicate clock key %q",key2)}
}
