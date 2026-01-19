// Share functionality has been disabled in this fork

export namespace ShareNext {
  export async function init() {
    // No-op: share functionality is not available
  }

  export async function create(_sessionID: string): Promise<{ id: string; url: string; secret: string }> {
    throw new Error("Share functionality is not available")
  }

  export async function remove(_sessionID: string): Promise<void> {
    throw new Error("Share functionality is not available")
  }
}
