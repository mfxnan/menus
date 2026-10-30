const MAX_IMAGE_SIZE = 5 * 1024 * 1024
const MAX_IMAGE_DIMENSION = 1200
const ACCEPTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

export async function compressProductImage(file: File): Promise<File> {
  if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
    throw new Error('Foto harus berformat JPEG, PNG, atau WebP.')
  }
  if (file.size > MAX_IMAGE_SIZE) {
    throw new Error('Ukuran foto maksimal 5 MB.')
  }

  const bitmap = await createImageBitmap(file)
  try {
    const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Browser tidak dapat memproses foto ini.')
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

    for (const type of ['image/webp', 'image/jpeg']) {
      for (const quality of [0.85, 0.75, 0.65]) {
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality))
        if (blob?.type === type && blob.size <= MAX_IMAGE_SIZE) {
          const extension = type === 'image/webp' ? 'webp' : 'jpg'
          const name = file.name.replace(/\.[^.]+$/, '') || 'product-image'
          return new File([blob], `${name}.${extension}`, { type, lastModified: Date.now() })
        }
      }
    }

    throw new Error('Foto tidak dapat dikompres menjadi ukuran maksimal 5 MB.')
  } finally {
    bitmap.close()
  }
}
