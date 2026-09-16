let _pendingClientId: string | null = null;

export function setPendingNewClientId(id: string) {
  _pendingClientId = id;
}

export function consumePendingNewClientId(): string | null {
  const id = _pendingClientId;
  _pendingClientId = null;
  return id;
}
