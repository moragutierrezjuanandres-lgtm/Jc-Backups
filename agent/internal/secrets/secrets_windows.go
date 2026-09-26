package secrets

import (
 "errors"
 "os"
 "syscall"
 "unsafe"
)

type blob struct { size uint32; data *byte }
func makeBlob(in []byte) blob {if len(in)==0{return blob{}};return blob{uint32(len(in)),&in[0]}}
var crypt32=syscall.NewLazyDLL("crypt32.dll")
var kernel32=syscall.NewLazyDLL("kernel32.dll")
func Protect(data []byte) ([]byte,error) {
 in:=makeBlob(data);var out blob
 p:=crypt32.NewProc("CryptProtectData")
 ok,_,err:=p.Call(uintptr(unsafe.Pointer(&in)),0,0,0,0,4,uintptr(unsafe.Pointer(&out)))
 if ok==0{return nil,err};defer kernel32.NewProc("LocalFree").Call(uintptr(unsafe.Pointer(out.data)))
 return append([]byte(nil),unsafe.Slice(out.data,out.size)...),nil
}
func Unprotect(data []byte) ([]byte,error) {
 if len(data)==0{return nil,errors.New("empty protected secret")}
 in:=makeBlob(data);var out blob
 p:=crypt32.NewProc("CryptUnprotectData")
 ok,_,err:=p.Call(uintptr(unsafe.Pointer(&in)),0,0,0,0,0,uintptr(unsafe.Pointer(&out)))
 if ok==0{return nil,err};defer kernel32.NewProc("LocalFree").Call(uintptr(unsafe.Pointer(out.data)))
 return append([]byte(nil),unsafe.Slice(out.data,out.size)...),nil
}
func Save(path string,data []byte) error {b,err:=Protect(data);if err!=nil{return err};return os.WriteFile(path,b,0600)}
func Load(path string) ([]byte,error) {b,err:=os.ReadFile(path);if err!=nil{return nil,err};return Unprotect(b)}
