from pathlib import Path

from PIL import Image


ASSETS = {
    Path("/home/ubuntu/upload/LogoEVGreenblanco(1).png"): Path("/home/ubuntu/webdev-static-assets/contracts/evgreen-logo-light-print.png"),
    Path("/home/ubuntu/upload/LogoEVGreennegro.png"): Path("/home/ubuntu/webdev-static-assets/contracts/evgreen-logo-dark-print.png"),
}


def optimize_logo(source: Path, target: Path, max_width: int = 2200) -> None:
    with Image.open(source) as image:
        image = image.convert("RGBA")
        if image.width > max_width:
            height = round(image.height * max_width / image.width)
            image = image.resize((max_width, height), Image.Resampling.LANCZOS)
        target.parent.mkdir(parents=True, exist_ok=True)
        image.save(target, format="PNG", optimize=True, compress_level=9)
        print(f"{source.name}: {image.width}x{image.height} -> {target}")


if __name__ == "__main__":
    for source_path, target_path in ASSETS.items():
        optimize_logo(source_path, target_path)
