// Share functionality has been disabled in this fork

export namespace Share {
  export function init() {
    // No-op: share functionality is not available
  }

  export const URL = ""

  export async function sync(_key: string, _content: any) {
    // No-op: share functionality is not available
  }

  export async function create(_sessionID: string): Promise<{ url: string; secret: string }> {
    throw new Error("Share functionality is not available")
  }

  export async function remove(_sessionID: string, _secret: string): Promise<void> {
    throw new Error("Share functionality is not available")
  }
}
