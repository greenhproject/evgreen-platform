#!/usr/bin/env python3
"""
Genera iconos para la PWA de EVGreen en múltiples tamaños.
"""

from PIL import Image, ImageDraw, ImageFont
import os

# Directorio de salida
OUTPUT_DIR = "/home/ubuntu/green-ev-platform/client/public/icons"

# Tamaños de iconos necesarios para PWA
ICON_SIZES = [72, 96, 128, 144, 152, 192, 384, 512]

# Colores de EVGreen
BG_COLOR = (10, 10, 10)  # #0a0a0a - Fondo oscuro
PRIMARY_COLOR = (5, 150, 105)  # #059669 - Verde esmeralda
ACCENT_COLOR = (16, 185, 129)  # #10b981 - Verde claro

def create_evgreen_icon(size):
    """Crea un icono de EVGreen con el rayo característico."""
    # Crear imagen con fondo
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Dibujar fondo redondeado
    padding = int(size * 0.1)
    corner_radius = int(size * 0.2)
    
    # Fondo con gradiente simulado (círculo verde)
    draw.rounded_rectangle(
        [padding, padding, size - padding, size - padding],
        radius=corner_radius,
        fill=PRIMARY_COLOR
    )
    
    # Dibujar el rayo (símbolo de EVGreen)
    center_x = size // 2
    center_y = size // 2
    bolt_size = int(size * 0.4)
    
    # Puntos del rayo
    bolt_points = [
        (center_x + bolt_size * 0.1, center_y - bolt_size * 0.5),   # Punta superior
        (center_x - bolt_size * 0.15, center_y - bolt_size * 0.05), # Lado izquierdo superior
        (center_x + bolt_size * 0.05, center_y - bolt_size * 0.05), # Centro superior
        (center_x - bolt_size * 0.1, center_y + bolt_size * 0.5),   # Punta inferior
        (center_x + bolt_size * 0.15, center_y + bolt_size * 0.05), # Lado derecho inferior
        (center_x - bolt_size * 0.05, center_y + bolt_size * 0.05), # Centro inferior
    ]
    
    # Dibujar el rayo
    draw.polygon(bolt_points, fill=(255, 255, 255))
    
    return img

def create_badge_icon(size):
    """Crea un icono de badge para notificaciones."""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Círculo verde
    padding = int(size * 0.1)
    draw.ellipse(
        [padding, padding, size - padding, size - padding],
        fill=PRIMARY_COLOR
    )
    
    # Rayo pequeño
    center_x = size // 2
    center_y = size // 2
    bolt_size = int(size * 0.3)
    
    bolt_points = [
        (center_x + bolt_size * 0.1, center_y - bolt_size * 0.5),
        (center_x - bolt_size * 0.15, center_y - bolt_size * 0.05),
        (center_x + bolt_size * 0.05, center_y - bolt_size * 0.05),
        (center_x - bolt_size * 0.1, center_y + bolt_size * 0.5),
        (center_x + bolt_size * 0.15, center_y + bolt_size * 0.05),
        (center_x - bolt_size * 0.05, center_y + bolt_size * 0.05),
    ]
    
    draw.polygon(bolt_points, fill=(255, 255, 255))
    
    return img

def create_shortcut_icon(size, icon_type):
    """Crea iconos para los shortcuts de la PWA."""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Fondo circular
    padding = int(size * 0.1)
    draw.ellipse(
        [padding, padding, size - padding, size - padding],
        fill=PRIMARY_COLOR
    )
    
    center_x = size // 2
    center_y = size // 2
    icon_size = int(size * 0.35)
    
    if icon_type == 'scan':
        # Icono de QR/escaneo
        qr_size = icon_size
        qr_x = center_x - qr_size // 2
        qr_y = center_y - qr_size // 2
        
        # Marco del QR
        draw.rectangle([qr_x, qr_y, qr_x + qr_size, qr_y + qr_size], outline=(255, 255, 255), width=2)
        
        # Esquinas
        corner_len = qr_size // 4
        # Superior izquierda
        draw.line([(qr_x, qr_y), (qr_x + corner_len, qr_y)], fill=(255, 255, 255), width=3)
        draw.line([(qr_x, qr_y), (qr_x, qr_y + corner_len)], fill=(255, 255, 255), width=3)
        # Superior derecha
        draw.line([(qr_x + qr_size, qr_y), (qr_x + qr_size - corner_len, qr_y)], fill=(255, 255, 255), width=3)
        draw.line([(qr_x + qr_size, qr_y), (qr_x + qr_size, qr_y + corner_len)], fill=(255, 255, 255), width=3)
        # Inferior izquierda
        draw.line([(qr_x, qr_y + qr_size), (qr_x + corner_len, qr_y + qr_size)], fill=(255, 255, 255), width=3)
        draw.line([(qr_x, qr_y + qr_size), (qr_x, qr_y + qr_size - corner_len)], fill=(255, 255, 255), width=3)
        # Inferior derecha
        draw.line([(qr_x + qr_size, qr_y + qr_size), (qr_x + qr_size - corner_len, qr_y + qr_size)], fill=(255, 255, 255), width=3)
        draw.line([(qr_x + qr_size, qr_y + qr_size), (qr_x + qr_size, qr_y + qr_size - corner_len)], fill=(255, 255, 255), width=3)
        
    elif icon_type == 'wallet':
        # Icono de billetera
        wallet_w = icon_size
        wallet_h = int(icon_size * 0.7)
        wallet_x = center_x - wallet_w // 2
        wallet_y = center_y - wallet_h // 2
        
        draw.rounded_rectangle(
            [wallet_x, wallet_y, wallet_x + wallet_w, wallet_y + wallet_h],
            radius=5,
            outline=(255, 255, 255),
            width=2
        )
        
        # Línea de cierre
        draw.line(
            [(wallet_x, wallet_y + wallet_h // 3), (wallet_x + wallet_w, wallet_y + wallet_h // 3)],
            fill=(255, 255, 255),
            width=2
        )
        
    elif icon_type == 'map':
        # Icono de mapa/ubicación
        pin_w = int(icon_size * 0.6)
        pin_h = icon_size
        pin_x = center_x
        pin_y = center_y - pin_h // 4
        
        # Círculo del pin
        draw.ellipse(
            [pin_x - pin_w // 2, pin_y - pin_w // 2, pin_x + pin_w // 2, pin_y + pin_w // 2],
            outline=(255, 255, 255),
            width=2
        )
        
        # Punto central
        dot_r = pin_w // 6
        draw.ellipse(
            [pin_x - dot_r, pin_y - dot_r, pin_x + dot_r, pin_y + dot_r],
            fill=(255, 255, 255)
        )
        
        # Punta del pin
        draw.polygon([
            (pin_x - pin_w // 3, pin_y + pin_w // 4),
            (pin_x + pin_w // 3, pin_y + pin_w // 4),
            (pin_x, pin_y + pin_h // 2)
        ], fill=(255, 255, 255))
    
    return img

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    print("Generando iconos de EVGreen para PWA...")
    
    # Generar iconos principales en todos los tamaños
    for size in ICON_SIZES:
        icon = create_evgreen_icon(size)
        icon.save(os.path.join(OUTPUT_DIR, f"icon-{size}x{size}.png"))
        print(f"  ✓ icon-{size}x{size}.png")
    
    # Generar badge para notificaciones
    badge = create_badge_icon(72)
    badge.save(os.path.join(OUTPUT_DIR, "badge-72x72.png"))
    print("  ✓ badge-72x72.png")
    
    # Generar iconos de shortcuts
    for shortcut_type in ['scan', 'wallet', 'map']:
        shortcut_icon = create_shortcut_icon(96, shortcut_type)
        shortcut_icon.save(os.path.join(OUTPUT_DIR, f"{shortcut_type}-shortcut.png"))
        print(f"  ✓ {shortcut_type}-shortcut.png")
    
    # Generar favicon
    favicon = create_evgreen_icon(32)
    favicon.save(os.path.join(OUTPUT_DIR, "favicon.ico"))
    print("  ✓ favicon.ico")
    
    # Generar apple-touch-icon
    apple_icon = create_evgreen_icon(180)
    apple_icon.save(os.path.join(OUTPUT_DIR, "apple-touch-icon.png"))
    print("  ✓ apple-touch-icon.png")
    
    print("\n✅ Todos los iconos generados exitosamente!")

if __name__ == "__main__":
    main()
