package runner

import (
 "bufio"
 "bytes"
 "context"
 "encoding/json"
 "errors"
 "fmt"
 "os"
 "os/exec"
 "path/filepath"
 "strings"
 "time"

 "jcevnzl/backup-agent/internal/journal"
)

type Policy struct { Enabled bool `json:"enabled"`; ID string `json:"id"`; DeviceID string `json:"deviceId"`; Revision int `json:"revision"`; SourceDirs []string `json:"sourceDirs"`; Excludes []string `json:"excludes"`; Days []int `json:"days"`; Time string `json:"time"`; Timezone string `json:"timezone"`; RetentionSuccessfulCount int `json:"retentionSuccessfulCount"`; ConsistencyProfile string `json:"consistencyProfile"`; Compression string `json:"compression"` }
type Run struct { ID string `json:"id"`; DeviceID string `json:"deviceId"`; PolicyRevision int `json:"policyRevision"`; OccurrenceKey string `json:"occurrenceKey"`; Status string `json:"status"`; Attempt int `json:"attempt"`; LeaseUntil time.Time `json:"leaseUntil"` }
type Repository struct { URL string `json:"url"`; Username string `json:"username"`; Password string `json:"password"`; Key string `json:"key"` }
type Runner struct { ResticPath string; Repository Repository; CacheDir string; Timeout time.Duration }

func (r Runner) Backup(ctx context.Context, run Run, policy Policy) journal.Result {
 if err:=ValidateSources(policy.SourceDirs,"",r.CacheDir);err!=nil{return journal.Result{ExitCode:-1,ErrorCode:"invalid_source",Message:err.Error()}}
 if policy.ConsistencyProfile!="" && policy.ConsistencyProfile!="files" && policy.ConsistencyProfile!="files-vss" {return journal.Result{ExitCode:-1,ErrorCode:"profile_unavailable",Message:"database profile is not configured and verified"}}
 timeout:=r.Timeout;if timeout<=0{timeout=12*time.Hour}
 ctx,cancel:=context.WithTimeout(ctx,timeout);defer cancel()
 if policy.Compression!="" && policy.Compression!="auto" && policy.Compression!="max" {return journal.Result{ExitCode:-1,ErrorCode:"invalid_compression",Message:"compression must be auto or max"}}
 args:=backupArgs(policy)
 cmd:=exec.CommandContext(ctx,r.ResticPath,args...)
 cmd.Env=append(os.Environ(),"RESTIC_REPOSITORY="+r.Repository.URL,"RESTIC_PASSWORD="+r.Repository.Key,"RESTIC_REST_USERNAME="+r.Repository.Username,"RESTIC_REST_PASSWORD="+r.Repository.Password)
 if r.CacheDir!="" {cmd.Env=append(cmd.Env,"RESTIC_CACHE_DIR="+r.CacheDir)}
 output,err:=cmd.CombinedOutput()
 code:=0;if err!=nil {var exit *exec.ExitError;if errors.As(err,&exit){code=exit.ExitCode()}else{code=-1}}
 result:=parseOutput(output,code)
 if ctx.Err()!=nil {result.ErrorCode="timeout_or_cancelled";result.Message=ctx.Err().Error();result.ExitCode=-1}
 return result
}

func backupArgs(policy Policy) []string {
 compression:=policy.Compression;if compression=="" {compression="auto"}
 args:=[]string{"backup","--json","--compression",compression,"--pack-size","16"}
 if policy.ConsistencyProfile=="files-vss" {args=append(args,"--use-fs-snapshot")}
 for _,x:=range policy.Excludes {args=append(args,"--exclude",x)}
 return append(args,policy.SourceDirs...)
}
func parseOutput(output []byte, code int) journal.Result {
 result:=journal.Result{ExitCode:code}
 scanner:=bufio.NewScanner(bytes.NewReader(output));scanner.Buffer(make([]byte,4096),1024*1024)
 for scanner.Scan() {
  var msg struct {MessageType string `json:"message_type"`; SnapshotID string `json:"snapshot_id"`; TotalBytesProcessed int64 `json:"total_bytes_processed"`; DataAdded int64 `json:"data_added"`; Error string `json:"error"`}
  if json.Unmarshal(scanner.Bytes(),&msg)!=nil{continue}
  if msg.MessageType=="summary" {result.SnapshotID=msg.SnapshotID;result.ProcessedBytes=msg.TotalBytesProcessed;result.AddedBytes=msg.DataAdded}
  if msg.MessageType=="error" && result.Message=="" {result.Message=msg.Error}
 }
 if code==0 && result.SnapshotID=="" {result.ErrorCode="missing_snapshot";result.ExitCode=-1}
 if code==3 {result.ErrorCode="partial"}
 if code!=0 && code!=3 && result.ErrorCode=="" {result.ErrorCode="restic_failed"}
 if len(result.Message)>500 {result.Message=result.Message[:500]}
 return result
}
func ValidateSources(sources []string, repositoryPath, cachePath string) error {
 if len(sources)==0{return errors.New("no source directories configured")}
 targets:=[]string{repositoryPath,cachePath}
 for _,source:=range sources {
  if !filepath.IsAbs(source) {return fmt.Errorf("source must be absolute: %q",source)}
  info,err:=os.Stat(source);if err!=nil{return err};if !info.IsDir(){return fmt.Errorf("source is not a directory: %q",source)}
  root,err:=filepath.EvalSymlinks(source);if err!=nil{return err}
  for _,target:=range targets {if target==""{continue};abs,err:=filepath.Abs(target);if err!=nil{return err}; if resolved,err:=filepath.EvalSymlinks(abs);err==nil{abs=resolved}
   rel,err:=filepath.Rel(root,abs);if err==nil && (rel=="." || (!strings.HasPrefix(rel,".."+string(filepath.Separator)) && rel!="..")){return fmt.Errorf("agent storage is inside source %q",source)}
  }
 }
 return nil
}
