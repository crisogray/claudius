import { test, expect } from "bun:test"
import { tmpdir } from "../fixture/fixture"
import { Instance } from "../../src/project/instance"
import { Agent } from "../../src/agent/agent"
import { PermissionNext } from "../../src/permission/next"

// Helper to evaluate permission for a tool with wildcard pattern
function evalPerm(agent: Agent.Info | undefined, permission: string): PermissionNext.Action | undefined {
  if (!agent) return undefined
  return PermissionNext.evaluate(permission, "*", agent.permission).action
}

test("returns only hidden agents", async () => {
  await using tmp = await tmpdir()
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const agents = await Agent.list()
      const names = agents.map((a) => a.name)
      // Only hidden agents exist now
      expect(names).toContain("compaction")
      expect(names).toContain("title")
      expect(names).toContain("summary")
      expect(names.length).toBe(3)
      // All agents should be hidden
      for (const agent of agents) {
        expect(agent.hidden).toBe(true)
      }
    },
  })
})

test("compaction agent denies all permissions", async () => {
  await using tmp = await tmpdir()
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const compaction = await Agent.get("compaction")
      expect(compaction).toBeDefined()
      expect(compaction?.hidden).toBe(true)
      expect(evalPerm(compaction, "bash")).toBe("deny")
      expect(evalPerm(compaction, "edit")).toBe("deny")
      expect(evalPerm(compaction, "read")).toBe("deny")
    },
  })
})

test("title agent has correct properties", async () => {
  await using tmp = await tmpdir()
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const title = await Agent.get("title")
      expect(title).toBeDefined()
      expect(title?.hidden).toBe(true)
      expect(title?.native).toBe(true)
      expect(title?.temperature).toBe(0.5)
      // Title agent should deny all tool use
      expect(evalPerm(title, "bash")).toBe("deny")
      expect(evalPerm(title, "edit")).toBe("deny")
    },
  })
})

test("summary agent has correct properties", async () => {
  await using tmp = await tmpdir()
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const summary = await Agent.get("summary")
      expect(summary).toBeDefined()
      expect(summary?.hidden).toBe(true)
      expect(summary?.native).toBe(true)
      // Summary agent should deny all tool use
      expect(evalPerm(summary, "bash")).toBe("deny")
      expect(evalPerm(summary, "edit")).toBe("deny")
    },
  })
})

test("Agent.get returns undefined for non-existent agent", async () => {
  await using tmp = await tmpdir()
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const nonExistent = await Agent.get("does_not_exist")
      expect(nonExistent).toBeUndefined()
    },
  })
})

test("Agent.get returns undefined for non-hidden agents like build", async () => {
  await using tmp = await tmpdir()
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      // Build agent no longer exists - only hidden agents are managed here
      const build = await Agent.get("build")
      expect(build).toBeUndefined()
    },
  })
})

test("defaultAgent returns default permission mode", async () => {
  await using tmp = await tmpdir()
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const defaultAgent = await Agent.defaultAgent()
      expect(defaultAgent).toBe("default")
    },
  })
})

test("Truncate.DIR is allowed for hidden agents", async () => {
  const { Truncate } = await import("../../src/util/truncation")
  await using tmp = await tmpdir()
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const compaction = await Agent.get("compaction")
      // Even hidden agents with deny * should allow Truncate.DIR for external_directory
      expect(PermissionNext.evaluate("external_directory", Truncate.DIR, compaction!.permission).action).toBe("allow")
    },
  })
})
