import type { Video, VideoMeta } from '../types/video'

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
    throw new Error(detail ?? `伺服器發生錯誤（${response.status}）。`)
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

export function submitVideo(url: string): Promise<VideoMeta> {
  return request('/api/videos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
}

export function deleteVideo(id: string): Promise<void> {
  return request(`/api/videos/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}
