import React from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import App from './App'
import Home from './routes/Home'
import Clip from './routes/Clip'
import Upload from './routes/Upload'
import Report from './routes/Report'
import './index.css'

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Home /> },
      { path: 'clip/:clipId', element: <Clip /> },
      { path: 'upload', element: <Upload /> },
      { path: 'report', element: <Report /> }
    ]
  }
])

const root = document.getElementById('root')!
createRoot(root).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
)
