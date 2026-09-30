package runner

import (
	"os/exec"
	"syscall"
)

func configurePriority(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{CreationFlags: 0x08004000}
}
