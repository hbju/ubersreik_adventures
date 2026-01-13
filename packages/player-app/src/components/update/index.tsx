import type { ProgressInfo } from 'electron-updater'
import { useCallback, useEffect, useState } from 'react'
import Modal from '@/components/update/Modal'
import Progress from '@/components/update/Progress'
import './update.css'

// GitHub releases URL for manual download
const GITHUB_RELEASES_URL = 'https://github.com/hbju/ubersreik_adventures/releases/latest'

// Detect platform - returns 'mac', 'win', or 'other'
const getPlatform = (): 'mac' | 'win' | 'other' => {
  const platform = window.navigator.platform.toLowerCase()
  if (platform.includes('mac')) return 'mac'
  if (platform.includes('win')) return 'win'
  return 'other'
}

const Update = () => {
  const [checking, setChecking] = useState(false)
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [versionInfo, setVersionInfo] = useState<VersionInfo>()
  const [updateError, setUpdateError] = useState<ErrorType>()
  const [progressInfo, setProgressInfo] = useState<Partial<ProgressInfo>>()
  const [modalOpen, setModalOpen] = useState<boolean>(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isDownloaded, setIsDownloaded] = useState(false)

  const platform = getPlatform()
  const isMac = platform === 'mac'
  const isWindows = platform === 'win'

  // Open GitHub releases page in default browser
  const openReleasesPage = () => {
    window.open(GITHUB_RELEASES_URL, '_blank')
  }

  const [modalBtn, setModalBtn] = useState<{
    cancelText?: string
    okText?: string
    onCancel?: () => void
    onOk?: () => void
  }>({
    onCancel: () => setModalOpen(false),
    onOk: () => {
      if (isWindows) {
        setIsDownloading(true)
        window.ipcRenderer.invoke('start-download')
      } else if (isMac) {
        openReleasesPage()
        setModalOpen(false)
      }
    },
  })

  const checkUpdate = async () => {
    setChecking(true)
    setIsDownloading(false)
    setIsDownloaded(false)
    /**
     * @type {import('electron-updater').UpdateCheckResult | null | { message: string, error: Error }}
     */
    const result = await window.ipcRenderer.invoke('check-update')
    setProgressInfo({ percent: 0 })
    setChecking(false)
    setModalOpen(true)
    if (result?.error) {
      setUpdateAvailable(false)
      setUpdateError(result?.error)
    }
  }

  const onUpdateCanAvailable = useCallback((_event: Electron.IpcRendererEvent, arg1: VersionInfo) => {
    setVersionInfo(arg1)
    setUpdateError(undefined)
    // Can be update
    if (arg1.update) {
      setModalBtn(state => ({
        ...state,
        cancelText: 'Cancel',
        okText: isMac ? 'Download from GitHub' : 'Update',
        onOk: () => {
          if (isWindows) {
            setIsDownloading(true)
            window.ipcRenderer.invoke('start-download')
          } else if (isMac) {
            openReleasesPage()
            setModalOpen(false)
          }
        },
      }))
      setUpdateAvailable(true)
    } else {
      setUpdateAvailable(false)
    }
  }, [isMac, isWindows])

  const onUpdateError = useCallback((_event: Electron.IpcRendererEvent, arg1: ErrorType) => {
    console.error('Update error:', arg1)
    setUpdateAvailable(false)
    setUpdateError(arg1)
    setIsDownloading(false)
  }, [])

  const onDownloadProgress = useCallback((_event: Electron.IpcRendererEvent, arg1: ProgressInfo) => {
    setProgressInfo(arg1)
  }, [])

  const onUpdateDownloaded = useCallback((_event: Electron.IpcRendererEvent, ...args: any[]) => {
    setProgressInfo({ percent: 100 })
    setIsDownloading(false)
    setIsDownloaded(true)
    setModalBtn(state => ({
      ...state,
      cancelText: 'Later',
      okText: 'Install now',
      onOk: () => window.ipcRenderer.invoke('quit-and-install'),
    }))
  }, [])

  useEffect(() => {
    // Get version information and whether to update
    window.ipcRenderer.on('update-can-available', onUpdateCanAvailable)
    window.ipcRenderer.on('update-error', onUpdateError)
    window.ipcRenderer.on('download-progress', onDownloadProgress)
    window.ipcRenderer.on('update-downloaded', onUpdateDownloaded)

    return () => {
      window.ipcRenderer.off('update-can-available', onUpdateCanAvailable)
      window.ipcRenderer.off('update-error', onUpdateError)
      window.ipcRenderer.off('download-progress', onDownloadProgress)
      window.ipcRenderer.off('update-downloaded', onUpdateDownloaded)
    }
  }, [onUpdateCanAvailable, onUpdateError, onDownloadProgress, onUpdateDownloaded])

  useEffect(() => {
    if (isWindows) {
      const timer = setTimeout(() => {
        window.ipcRenderer.invoke('check-update')
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [isWindows])

  const renderUpdateContent = () => {
    if (updateError) {
      return (
        <div>
          <p>Error checking for updates.</p>
          <p>{updateError.message}</p>
        </div>
      )
    }

    if (updateAvailable) {
      return (
        <div>
          <div>A new version is available: v{versionInfo?.newVersion}</div>
          <div className='new-version__target'>v{versionInfo?.version} → v{versionInfo?.newVersion}</div>

          {isMac ? (
            <div className='mac-update-notice'>
              <p>Click the button below to download the latest version from GitHub.</p>
              <p className='mac-update-hint'>
                (Auto-updates are not available on macOS without code signing)
              </p>
            </div>
          ) : (
            <div className='update__progress'>
              <div className='progress__title'>
                {isDownloaded ? 'Download complete!' : isDownloading ? 'Downloading:' : 'Ready to download'}
              </div>
              {(isDownloading || isDownloaded) && (
                <div className='progress__bar'>
                  <Progress percent={progressInfo?.percent} />
                </div>
              )}
            </div>
          )}
        </div>
      )
    }

    return (
      <div className='can-not-available'>
        {versionInfo ? (
          <p>You are running the latest version (v{versionInfo.version})</p>
        ) : (
          <p>Checking for updates...</p>
        )}
      </div>
    )
  }

  return (
    <>
      <Modal
        open={modalOpen}
        cancelText={modalBtn?.cancelText}
        okText={modalBtn?.okText}
        onCancel={modalBtn?.onCancel}
        onOk={modalBtn?.onOk}
        footer={updateAvailable ? undefined : null}
      >
        <div className='modal-slot'>
          {renderUpdateContent()}
        </div>
      </Modal>
      <button disabled={checking} onClick={checkUpdate} className='check-update-btn'>
        {checking ? 'Checking...' : 'Check update'}
      </button>
    </>
  )
}

export default Update
