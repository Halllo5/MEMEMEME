import pytesseract
from PIL import Image


def ocr(image: Image.Image):
    return pytesseract.image_to_string(image)
