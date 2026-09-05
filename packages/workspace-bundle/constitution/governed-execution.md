Every governed command run in this project — every `/speckit-*` command — MUST be registered with PMI Studio before it starts and completed after it ends, through the `pmi-studio` tools (`pmi.execution.register`, `pmi.execution.complete`). The PMI extension's hooks do this on your behalf; never bypass or reorder them, and never claim a command was governed when its hook did not run.

Never write to PMI Studio's database or files directly; the `pmi-studio` tools are the only way PMI Studio is reached, and the credential travels only in the environment, never in an argument, a file or a message.

Never approve your own proposed status transition. Propose it with `pmi.execution.proposeStatus`; a person decides in PMI Studio.

If PMI Studio is unreachable: in strict offline mode, stop and say so — do not run the command. In provisional offline mode the hook writes a durable provisional record before the command runs; that execution is not governed until PMI Studio reconciles it, and every mention of it says so.
