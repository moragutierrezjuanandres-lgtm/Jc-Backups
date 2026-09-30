//go:build !windows

package runner

import "os/exec"

func configurePriority(cmd *exec.Cmd) {}
