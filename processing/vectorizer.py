from typing import List, Union

from PIL import Image
from sentence_transformers import SentenceTransformer


class Vectorizer:
    """Handles semantic vectorization of images and text using CLIP."""
    
    def __init__(self, model_name: str = "clip-ViT-B-32"):
        """Initialize the vectorizer with a SentenceTransformer model.
        
        Args:
            model_name: The name of the CLIP model to use.
        """
        self.model = SentenceTransformer(model_name)

    def vectorize_image(self, image: Image.Image) -> List[float]:
        """Generate a vector embedding for a given image.

        Args:
            image: A PIL Image object.

        Returns:
            A list of floats representing the image embedding.
        """
        # encode returns a numpy array, we convert to list for easy storage
        embedding = self.model.encode(image)
        return embedding.tolist()

    def vectorize_text(self, text: Union[str, List[str]]) -> Union[List[float], List[List[float]]]:
        """Generate a vector embedding for text (search queries).

        Args:
            text: A string or list of strings to vectorize.

        Returns:
            A list of floats (if input is str) or list of lists (if input is list[str]).
        """
        embedding = self.model.encode(text)
        return embedding.tolist()

# Singleton instance
vectorizer = Vectorizer()
