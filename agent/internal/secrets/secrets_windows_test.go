package secrets

import (
 "bytes"
 "os"
 "path/filepath"
 "testing"
)

func TestProtectedAtomicReplacement(t *testing.T){
 path:=filepath.Join(t.TempDir(),"config.dpapi")
 for _,plain:=range []string{"secret-one","secret-two"}{
  if err:=Save(path,[]byte(plain));err!=nil{t.Fatal(err)}
  disk,err:=os.ReadFile(path);if err!=nil{t.Fatal(err)}
  if bytes.Contains(disk,[]byte(plain)){t.Fatal("plaintext secret persisted")}
  got,err:=Load(path);if err!=nil||string(got)!=plain{t.Fatalf("reload: %q %v",got,err)}
 }
}
