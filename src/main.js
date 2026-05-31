import './style.css';
import AOS from 'aos';
import 'aos/dist/aos.css';

document.addEventListener('DOMContentLoaded', () => {
    // --- 3D GLOBE SCROLLYTELLING CANVAS ENGINE ---
    // 1. Canvas Setup
    const canvas = document.createElement("canvas");
    canvas.id = "hero-scrolly-canvas";
    canvas.style.position = "fixed";
    canvas.style.inset = "0";
    canvas.style.width = "100vw";
    canvas.style.height = "100vh";
    canvas.style.zIndex = "-1";
    canvas.style.pointerEvents = "none";
    document.body.appendChild(canvas);

    const ctx = canvas.getContext("2d");

    // State
    let useFallback = false;
    let fallbackInitialized = false;
    const frameCount = 192;
    const images = [];
    let loadedCount = 0;
    
    // Responsive Sphere Coordinates
    let globeCenter = { x: window.innerWidth * 0.5, y: window.innerHeight * 0.5 };
    let globeRadius = Math.min(window.innerWidth, window.innerHeight) * 0.35;
    
    function updateGlobeDimensions() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        // Position on the right side for desktop, center for mobile
        if (width >= 1024) {
            globeCenter.x = width * 0.72;
            globeCenter.y = height * 0.5;
            globeRadius = Math.min(width, height) * 0.35;
        } else {
            globeCenter.x = width * 0.5;
            globeCenter.y = height * 0.5;
            globeRadius = Math.min(width, height) * 0.32;
        }
    }
    updateGlobeDimensions();

    // 3D Particles Definition
    const particles = [];
    const particleCount = 550;
    
    function isLand(x, y, z) {
        // Spherical noise approximation for continent outlines
        const n = Math.sin(x * 2.8) * Math.sin(y * 2.8) * Math.cos(z * 2.8) +
                  Math.sin(x * 1.2 + 0.8) * Math.cos(y * 1.5) * Math.sin(z * 1.5) +
                  Math.cos(x * 4.5) * Math.sin(y * 4.5) * Math.cos(z * 4.5) * 0.25;
        return n > -0.05; // threshold
    }

    function getRegion(x, y, z) {
        if (!isLand(x, y, z)) {
            return "ocean";
        }
        
        // Specific coordinate bounding box representing India peninsula on local grid
        if (x >= 0.2 && x <= 0.45 && y >= -0.38 && y <= -0.08 && z >= 0.35 && z <= 0.8) {
            return "india";
        }
        
        // Standard coordinate bounding box representing Asia continent on local grid
        if (x >= -0.15 && x <= 0.95 && y >= -0.65 && y <= 0.6 && z >= -0.55 && z <= 0.9) {
            return "asia";
        }
        
        return "other-land";
    }

    // Distribute points on sphere using Fibonacci spiral (golden ratio)
    function initFallbackGlobe() {
        particles.length = 0;
        const goldenRatio = (1 + Math.sqrt(5)) / 2;
        
        for (let i = 0; i < particleCount; i++) {
            const theta = 2 * Math.PI * i / goldenRatio;
            const phi = Math.acos(1 - 2 * (i + 0.5) / particleCount);
            
            // 3D sphere coordinate equations
            const x = Math.cos(theta) * Math.sin(phi);
            const y = Math.sin(theta) * Math.sin(phi);
            const z = Math.cos(phi);
            
            const region = getRegion(x, y, z);
            particles.push({ x, y, z, region });
        }
        fallbackInitialized = true;
    }

    // Preloading Engine for Image Sequence
    const currentFrame = (index) => {
        const frameNumber = String(index).padStart(3, '0');
        return `/images/sequence/ezgif-frame-${frameNumber}.jpg`;
    };

    // Load first image as a quick check
    const firstImg = new Image();
    firstImg.onload = () => {
        // If the first image succeeds, start preloading the rest
        images.push(firstImg);
        preloadRemainingImages();
    };
    firstImg.onerror = () => {
        // If first image fails, fall back to procedural globe
        useFallback = true;
        initFallbackGlobe();
        requestAnimationFrame(renderFallbackGlobe);
    };
    firstImg.src = currentFrame(1);

    // If first image takes too long to load (e.g. 404 block), trigger fallback
    const fallbackTimeout = setTimeout(() => {
        if (!useFallback && loadedCount === 0) {
            useFallback = true;
            initFallbackGlobe();
            requestAnimationFrame(renderFallbackGlobe);
        }
    }, 400);

    function preloadRemainingImages() {
        clearTimeout(fallbackTimeout);
        for (let i = 2; i <= frameCount; i++) {
            const img = new Image();
            img.onload = () => {
                loadedCount++;
            };
            img.onerror = () => {
                // Fall back if we hit load issues
                useFallback = true;
                if (!fallbackInitialized) {
                    initFallbackGlobe();
                    requestAnimationFrame(renderFallbackGlobe);
                }
            };
            img.src = currentFrame(i);
            images.push(img);
        }
        // Render first frame immediately
        renderImageFrame(0);
    }

    // High-DPI Responsive Contain Render Loop (Image Sequence)
    function renderImageFrame(index) {
        if (useFallback) return;
        const activeImage = images[index] || firstImg;
        if (!activeImage || !activeImage.complete) return;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = window.innerWidth * dpr;
        canvas.height = window.innerHeight * dpr;
        ctx.scale(dpr, dpr);

        const imgWidth = activeImage.width;
        const imgHeight = activeImage.height;
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;

        const ratio = Math.min(screenWidth / imgWidth, screenHeight / imgHeight);
        const newWidth = imgWidth * ratio;
        const newHeight = imgHeight * ratio;
        
        // Positional adjustment to match layout (desktop right-aligned, mobile centered)
        let xOffset = (screenWidth - newWidth) / 2;
        if (screenWidth >= 1024) {
            xOffset = screenWidth * 0.72 - newWidth / 2;
        }
        const yOffset = (screenHeight - newHeight) / 2;

        ctx.clearRect(0, 0, screenWidth, screenHeight);
        ctx.drawImage(activeImage, xOffset, yOffset, newWidth, newHeight);
    }

    // Procedural 3D Particle Globe Render Engine
    let rotationY = 0;
    let rotationX = 0.2; // slight tilt
    let targetRotationY = 0;
    let targetRotationX = 0.2;
    
    function renderFallbackGlobe() {
        if (!useFallback) return;
        
        const dpr = window.devicePixelRatio || 1;
        canvas.width = window.innerWidth * dpr;
        canvas.height = window.innerHeight * dpr;
        ctx.scale(dpr, dpr);
        
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;
        ctx.clearRect(0, 0, screenWidth, screenHeight);
        
        // Smooth interpolation to target rotation
        rotationY += (targetRotationY - rotationY) * 0.08;
        rotationX += (targetRotationX - rotationX) * 0.08;
        
        // Idle rotation when not scrolling
        targetRotationY += 0.0025;
        
        const cosY = Math.cos(rotationY);
        const sinY = Math.sin(rotationY);
        const cosX = Math.cos(rotationX);
        const sinX = Math.sin(rotationX);
        
        // Project points and store screen coordinates
        const projected = [];
        
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            
            // Rotate around Y axis
            let x1 = p.x * cosY - p.z * sinY;
            let z1 = p.x * sinY + p.z * cosY;
            
            // Rotate around X axis
            let y2 = p.y * cosX - z1 * sinX;
            let z2 = p.y * sinX + z1 * cosX;
            
            // Perspective projection
            const cameraDistance = 2.5;
            const perspective = 1 / (cameraDistance - z2);
            
            const screenX = globeCenter.x + x1 * globeRadius * perspective;
            const screenY = globeCenter.y + y2 * globeRadius * perspective;
            
            projected.push({
                x: screenX,
                y: screenY,
                z: z2, // keep depth for occlusion/shading
                index: i
            });
        }
        
        // Draw connections (mesh wireframe)
        ctx.lineWidth = 0.4;
        const maxDistanceSq = 0.15; // 3D distance threshold squared
        
        for (let i = 0; i < particles.length; i++) {
            const p1 = particles[i];
            const proj1 = projected[i];
            
            // Don't draw connections for back-facing particles to reduce clutter
            if (proj1.z < -0.25) continue;
            
            // Find neighbors
            for (let j = i + 1; j < particles.length; j++) {
                const p2 = particles[j];
                const proj2 = projected[j];
                if (proj2.z < -0.25) continue;
                
                const p1Region = p1.region;
                const p2Region = p2.region;
                
                // Only connect if at least one is a land particle to avoid ocean line clutter
                if (p1Region === "ocean" && p2Region === "ocean") continue;
                
                const dx = p1.x - p2.x;
                const dy = p1.y - p2.y;
                const dz = p1.z - p2.z;
                const distSq = dx*dx + dy*dy + dz*dz;
                
                if (distSq < maxDistanceSq) {
                    const isIndiaConn = p1Region === "india" && p2Region === "india";
                    const isAsiaConn = p1Region === "asia" && p2Region === "asia";
                    
                    let baseAlpha = 0.08;
                    if (isIndiaConn) baseAlpha = 0.35;
                    else if (isAsiaConn) baseAlpha = 0.2;
                    else if (p1Region === "other-land" && p2Region === "other-land") baseAlpha = 0.12;
                    
                    const alpha = (1 - (distSq / maxDistanceSq)) * baseAlpha * (proj1.z + 1.25) * (proj2.z + 1.25);
                    
                    if (isIndiaConn) {
                        ctx.strokeStyle = `rgba(245, 158, 11, ${alpha * 0.3})`; // Amber Gold connection
                    } else if (isAsiaConn) {
                        ctx.strokeStyle = `rgba(225, 29, 72, ${alpha * 0.22})`; // Crimson Rose connection
                    } else {
                        ctx.strokeStyle = `rgba(11, 37, 69, ${alpha * 0.14})`; // Deep Navy connection
                    }
                    
                    ctx.beginPath();
                    ctx.moveTo(proj1.x, proj1.y);
                    ctx.lineTo(proj2.x, proj2.y);
                    ctx.stroke();
                }
            }
        }
        
        // Draw points (sorted by depth Z for correct paint overlap)
        const sorted = [...projected].sort((a, b) => a.z - b.z);
        
        for (let i = 0; i < sorted.length; i++) {
            const p = sorted[i];
            const origParticle = particles[p.index];
            const depthFactor = (p.z + 1) / 2; // [0, 1]
            
            // 1. Particle Dot Scale Reduction (visibly smaller, ultra-fine, razor-sharp)
            let baseSize = 0.4;
            let scaleMultiplier = 1.0;
            
            if (origParticle.region === "india") {
                baseSize = 0.7;
                scaleMultiplier = 1.8;
            } else if (origParticle.region === "asia") {
                baseSize = 0.55;
                scaleMultiplier = 1.4;
            } else if (origParticle.region === "other-land") {
                baseSize = 0.45;
                scaleMultiplier = 1.1;
            } else { // ocean
                baseSize = 0.2;
                scaleMultiplier = 0.5;
            }
            
            const size = baseSize + depthFactor * scaleMultiplier;
            
            let baseAlpha = 0.08;
            let depthSpan = 0.7;
            
            if (origParticle.region === "india") {
                baseAlpha = 0.3;
                depthSpan = 0.7;
            } else if (origParticle.region === "asia") {
                baseAlpha = 0.2;
                depthSpan = 0.7;
            } else if (origParticle.region === "other-land") {
                baseAlpha = 0.12;
                depthSpan = 0.6;
            } else { // ocean
                baseAlpha = 0.02;
                depthSpan = 0.2;
            }
            
            const alpha = baseAlpha + depthFactor * depthSpan;
            
            let color;
            if (origParticle.region === "india") {
                // India isolated with premium Gold accent shade
                color = `rgba(245, 158, 11, ${alpha})`;
            } else if (origParticle.region === "asia") {
                // Asia mapped to bright contrasting corporate crimson
                color = `rgba(225, 29, 72, ${alpha})`;
            } else if (origParticle.region === "other-land") {
                // Other landmasses rendered in soft rose-slate
                color = `rgba(180, 100, 110, ${alpha * 0.75})`;
            } else {
                // Ocean isolated and colored exactly deep navy rgb(11, 37, 69)
                color = `rgba(11, 37, 69, ${alpha})`;
            }
            
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, size, 0, 2 * Math.PI);
            ctx.fill();
            
            // Add subtle glow to larger front points for India and Asia
            if (depthFactor > 0.8) {
                if (origParticle.region === "india") {
                    ctx.fillStyle = `rgba(251, 191, 36, ${alpha * 0.35})`;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, size * 2.2, 0, 2 * Math.PI);
                    ctx.fill();
                } else if (origParticle.region === "asia") {
                    ctx.fillStyle = `rgba(225, 29, 72, ${alpha * 0.25})`;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, size * 2.2, 0, 2 * Math.PI);
                    ctx.fill();
                }
            }
        }
        
        requestAnimationFrame(renderFallbackGlobe);
    }

    // 4. Scroll Tracking
    window.addEventListener("scroll", () => {
        const scrollTop = window.scrollY;
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        const scrollFraction = maxScroll > 0 ? scrollTop / maxScroll : 0;

        if (useFallback) {
            // Map scroll directly to rotation
            targetRotationY = scrollFraction * Math.PI * 4;
            targetRotationX = 0.2 + scrollFraction * 0.4;
        } else {
            const frameIndex = Math.min(
                frameCount - 1,
                Math.floor(scrollFraction * frameCount)
            );
            requestAnimationFrame(() => renderImageFrame(frameIndex));
        }
    });

    // Handle Resize
    window.addEventListener("resize", () => {
        updateGlobeDimensions();
        if (useFallback) {
            // Recalculates dynamically in render loop
        } else {
            const scrollTop = window.scrollY;
            const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
            const scrollFraction = maxScroll > 0 ? scrollTop / maxScroll : 0;
            const frameIndex = Math.min(
                frameCount - 1,
                Math.floor(scrollFraction * frameCount)
            );
            renderImageFrame(frameIndex);
        }
    });

    // --- AOS INITIALIZATION ---
    AOS.init({
        duration: 800,
        once: true,
        offset: 100,
    });
    
    // Mobile menu toggle
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    
    if (mobileMenuBtn && mobileMenu) {
        mobileMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            mobileMenu.classList.toggle('hidden');
        });

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!mobileMenu.contains(e.target) && !mobileMenuBtn.contains(e.target)) {
                mobileMenu.classList.add('hidden');
            }
        });
    }

    // Close mobile menu on link click
    const mobileLinks = document.querySelectorAll('#mobile-menu a');
    mobileLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (mobileMenu) {
                mobileMenu.classList.add('hidden');
            }
        });
    });

    // Scroll Spy active navigation link highlighting
    const sections = document.querySelectorAll('main > section[id]');
    const navLinks = document.querySelectorAll('.nav-link');
    
    const observerOptions = {
        root: null,
        rootMargin: '-20% 0px -70% 0px', // Trigger when section starts occupying upper part of viewport
        threshold: 0
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const id = entry.target.getAttribute('id');
                navLinks.forEach(link => {
                    const href = link.getAttribute('href');
                    if (href === `#${id}` || (href === 'index.html' && id === 'home')) {
                        link.classList.add('active');
                    } else {
                        link.classList.remove('active');
                    }
                });
            }
        });
    }, observerOptions);
    
    sections.forEach(section => {
        observer.observe(section);
    });

    // Contact Form WhatsApp Submission Routing
    const contactForm = document.getElementById('contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const firstName = document.getElementById('firstName').value.trim();
            const lastName = document.getElementById('lastName').value.trim();
            const email = document.getElementById('email').value.trim();
            const phone = document.getElementById('phone').value.trim() || 'N/A';
            const industrySelect = document.getElementById('industry');
            const industry = industrySelect ? industrySelect.options[industrySelect.selectedIndex].text : 'N/A';
            const scope = document.getElementById('scope').value.trim();
            
            const message = `Hello ThinkASIA,\n\nI would like to submit an advisory request with the following details:\n\n` +
                `*Name:* ${firstName} ${lastName}\n` +
                `*Email:* ${email}\n` +
                `*Phone:* ${phone}\n` +
                `*Industry:* ${industry}\n\n` +
                `*Project Scope & Requirements:*\n${scope}`;
                
            const whatsappUrl = `https://wa.me/918796265005?text=${encodeURIComponent(message)}`;
            window.open(whatsappUrl, '_blank');
        });
    }
});
