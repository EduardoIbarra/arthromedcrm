import { useState, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import Modal from '@/components/Modal'

interface Point {
  x: number
  y: number
}

interface Area {
  width: number
  height: number
  x: number
  y: number
}

interface ImageCropperProps {
  open: boolean
  image: string
  onClose: () => void
  onCropComplete: (croppedBlob: Blob) => void
}

const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', (error) => reject(error))
    image.setAttribute('crossOrigin', 'anonymous')
    image.src = url
  })

export default function ImageCropper({ open, image, onClose, onCropComplete }: ImageCropperProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const onCropCompleteLocal = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }, [])

  const handleCrop = async () => {
    if (!croppedAreaPixels) return
    setIsProcessing(true)
    try {
      const croppedImage = await getCroppedImg(image, croppedAreaPixels)
      if (croppedImage) {
        onCropComplete(croppedImage)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Recortar Imagen">
      <div className="relative h-[400px] w-full bg-black rounded-lg overflow-hidden">
        <Cropper
          image={image}
          crop={crop}
          zoom={zoom}
          aspect={1}
          onCropChange={setCrop}
          onCropComplete={onCropCompleteLocal}
          onZoomChange={setZoom}
          showGrid={false}
          cropShape="round"
        />
      </div>
      <div className="mt-4">
        <label className="text-sm font-medium text-gray-700 mb-1 block">Zoom</label>
        <input
          type="range"
          value={zoom}
          min={1}
          max={3}
          step={0.1}
          aria-labelledby="Zoom"
          onChange={(e) => setZoom(Number(e.target.value))}
          className="w-full"
        />
      </div>
      <div className="flex justify-end gap-3 mt-6">
        <button type="button" onClick={onClose} className="btn-secondary">
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleCrop}
          disabled={isProcessing}
          className="btn-primary"
        >
          {isProcessing ? 'Procesando...' : 'Aplicar'}
        </button>
      </div>
    </Modal>
  )
}

async function getCroppedImg(
  imageSrc: string,
  pixelCrop: Area,
  flip = { horizontal: false, vertical: false }
): Promise<Blob | null> {
  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    return null
  }

  canvas.width = image.width
  canvas.height = image.height

  ctx.translate(image.width / 2, image.height / 2)
  ctx.scale(flip.horizontal ? -1 : 1, flip.vertical ? -1 : 1)
  ctx.translate(-image.width / 2, -image.height / 2)

  ctx.drawImage(image, 0, 0)

  const data = ctx.getImageData(0, 0, image.width, image.height)

  canvas.width = pixelCrop.width
  canvas.height = pixelCrop.height

  ctx.putImageData(
    data,
    Math.round(0 - pixelCrop.x),
    Math.round(0 - pixelCrop.y)
  )

  return new Promise((resolve, reject) => {
    canvas.toBlob((file) => {
      if (file) {
        resolve(file)
      } else {
        reject(new Error('Canvas is empty'))
      }
    }, 'image/jpeg')
  })
}
