import type { Video, VideoMeta } from '../types/video'

/** An error answer of the backend. `code` names the kind of failure. */
export class ApiError extends Error {
  code: string

  constructor(message: string, code = 'error') {
    super(message)
    this.code = code
  }
}

/** The owner blocks the video on other sites; it can be downloaded. */
export function isNotEmbeddable(reason: unknown): boolean {
  return reason instanceof ApiError && reason.code === 'not_embeddable'
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, init)
  } catch {
    throw new Error('無法連線到後端服務，請確認已執行 make serve。')
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    const detail = typeof body?.detail === 'string' ? body.detail : null
    throw new ApiError(
      detail ?? `伺服器發生錯誤（${response.status}）。`,
      typeof body?.code === 'string' ? body.code : undefined,
    )
  }
  if (response.status === 204) {
    return undefined as T
  }
  return response.json() as Promise<T>
}

export function listVideos(): Promise<VideoMeta[]> {
  return request('/api/videos')
}

export function getVideo(id: string): Promise<Video> {
  return request(`/api/videos/${encodeURIComponent(id)}`)
}

/** `download` keeps a copy of the video on this computer and plays that. */
export function submitVideo(
  url: string,
  download = false,
): Promise<VideoMeta> {
  return request('/api/videos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, download }),
  })
}

/** Start downloading the video of a finished video. */
export function downloadVideo(id: string): Promise<VideoMeta> {
  return request(`/api/videos/${encodeURIComponent(id)}/download`, {
    method: 'POST',
  })
}

export function videoFileUrl(id: string): string {
  return `/api/videos/${encodeURIComponent(id)}/file`
}

export function deleteVideo(id: string): Promise<void> {
  return request(`/api/videos/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}
