import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import HomePage from './pages/HomePage'
import StudyPage from './pages/StudyPage'
import VideoLayout from './pages/VideoLayout'
import WatchPage from './pages/WatchPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/v/:id" element={<VideoLayout />}>
          <Route index element={<Navigate to="study" replace />} />
          <Route path="study" element={<StudyPage />} />
          <Route path="watch" element={<WatchPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
