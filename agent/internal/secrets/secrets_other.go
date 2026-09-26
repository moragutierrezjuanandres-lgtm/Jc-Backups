//go:build !windows
package secrets

import "errors"
func Protect([]byte)([]byte,error){return nil,errors.New("Windows DPAPI required")}
func Unprotect([]byte)([]byte,error){return nil,errors.New("Windows DPAPI required")}
func Save(string,[]byte)error{return errors.New("Windows DPAPI required")}
func Load(string)([]byte,error){return nil,errors.New("Windows DPAPI required")}
