import multer from 'multer';

const upload = multer({ limits: { fileSize: 100 * 1024 * 1024 } });

export { upload };
