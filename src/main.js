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
    const particleCount = 3500; // High density for ultra-fidelity continent outlines
    const connections = [];

    // Precompute Connections to optimize rendering loop (eliminate O(N^2) distance checks)
    function precomputeConnections() {
        connections.length = 0;
        const maxDistance = 0.08;
        const maxDistanceSq = maxDistance * maxDistance;
        
        for (let i = 0; i < particles.length; i++) {
            const p1 = particles[i];
            if (p1.region === "ocean") continue;
            
            for (let j = i + 1; j < particles.length; j++) {
                const p2 = particles[j];
                if (p2.region === "ocean") continue;
                
                const dx = p1.x - p2.x;
                const dy = p1.y - p2.y;
                const dz = p1.z - p2.z;
                const distSq = dx*dx + dy*dy + dz*dz;
                
                if (distSq < maxDistanceSq) {
                    connections.push({
                        i,
                        j,
                        distSq,
                        isIndiaConn: p1.region === "india" && p2.region === "india",
                        isAsiaConn: p1.region === "asia" && p2.region === "asia"
                    });
                }
            }
        }
    }

    // Mathematical Fallback Globe (runs immediately before texture loads)
    function initGlobeFallback() {
        particles.length = 0;
        const goldenRatio = (1 + Math.sqrt(5)) / 2;
        
        for (let i = 0; i < particleCount; i++) {
            const theta = 2 * Math.PI * i / goldenRatio;
            const phi = Math.acos(1 - 2 * (i + 0.5) / particleCount);
            
            // 3D sphere coordinate equations
            const x = Math.cos(theta) * Math.sin(phi);
            const y = Math.sin(theta) * Math.sin(phi);
            const z = Math.cos(phi);
            
            const lon = Math.atan2(z, x);
            const lat = Math.asin(y);
            
            let isBaseLand = false;
            // Crude bounding boxes for immediate rendering
            if (lat > -0.15 && lat < 1.3 && lon > -0.35 && lon < 2.9) isBaseLand = true;
            else if (lat > -0.62 && lat < 0.62 && lon > -0.35 && lon < 0.9) isBaseLand = true;
            else if (lat > -0.7 && lat < -0.18 && lon > 1.8 && lon < 2.7) isBaseLand = true;
            else if (lat > 0.12 && lat < 1.3 && (lon < -0.95 || lon > 3.0)) isBaseLand = true;
            else if (lat > -0.9 && lat < 0.22 && lon > -1.45 && lon < -0.6) isBaseLand = true;
            
            let region = "ocean";
            if (isBaseLand) {
                if (lat > 0.12 && lat < 0.63 && lon > 1.18 && lon < 1.69) {
                    region = "india";
                } else if (lat > -0.17 && lat < 1.31 && lon > 0.45 && lon < 2.97) {
                    region = "asia";
                } else {
                    region = "other-land";
                }
            }
            
            particles.push({ x, y, z, region });
        }
        precomputeConnections();
    }

    // High-Fidelity Geographically Accurate Globe initialization
    let mapData = null;
    let mapWidth = 0;
    let mapHeight = 0;

    function initGlobeWithTextureData(data, width, height) {
        mapData = data;
        mapWidth = width;
        mapHeight = height;

        particles.length = 0;
        const goldenRatio = (1 + Math.sqrt(5)) / 2;
        
        for (let i = 0; i < particleCount; i++) {
            const theta = 2 * Math.PI * i / goldenRatio;
            const phi = Math.acos(1 - 2 * (i + 0.5) / particleCount);
            
            const x = Math.cos(theta) * Math.sin(phi);
            const y = Math.sin(theta) * Math.sin(phi);
            const z = Math.cos(phi);
            
            const lon = Math.atan2(z, x);
            const lat = Math.asin(y);
            
            // Map longitude/latitude to image coordinates
            const px = Math.floor(((lon + Math.PI) / (2 * Math.PI)) * mapWidth);
            const py = Math.floor(((Math.PI / 2 - lat) / Math.PI) * mapHeight);
            
            // Sample image pixel (Red channel)
            const idx = (py * mapWidth + px) * 4;
            const isLandVal = mapData[idx] > 128;
            
            let region = "ocean";
            if (isLandVal) {
                // India bounds
                if (lat > 0.12 && lat < 0.63 && lon > 1.18 && lon < 1.69) {
                    region = "india";
                }
                // Asia bounds
                else if (lat > -0.17 && lat < 1.31 && lon > 0.45 && lon < 2.97) {
                    region = "asia";
                } else {
                    region = "other-land";
                }
            }
            
            particles.push({ x, y, z, region });
        }
        precomputeConnections();
    }

    // Load world map texture image
    const mapImg = new Image();
    mapImg.src = "/world-map-texture.png";
    mapImg.onload = () => {
        const offscreen = document.createElement("canvas");
        offscreen.width = 360;
        offscreen.height = 180;
        const oCtx = offscreen.getContext("2d");
        oCtx.drawImage(mapImg, 0, 0, 360, 180);
        const imgData = oCtx.getImageData(0, 0, 360, 180);
        initGlobeWithTextureData(imgData.data, 360, 180);
    };
    mapImg.onerror = () => {
        console.warn("Failed to load world map texture, using mathematical fallback");
    };

    // Initialize immediate fallback globe so canvas is never empty
    initGlobeFallback();

    // Procedural 3D Particle Globe Render Engine
    let rotationY = 0;
    let rotationX = 0.2; // slight tilt
    let targetRotationY = 0;
    let targetRotationX = 0.2;
    
    // Define cities with 3D coordinates pre-calculated
    const cities = [
        { name: "Delhi", lat: 0.50, lon: 1.35, align: "left" },
        { name: "Mumbai", lat: 0.33, lon: 1.27, align: "right" },
        { name: "Bengaluru", lat: 0.23, lon: 1.35, align: "right" },
        { name: "Chennai", lat: 0.23, lon: 1.40, align: "left" },
        { name: "Kolkata", lat: 0.39, lon: 1.54, align: "left" },
        { name: "Chnnalari", lat: 0.02, lon: 1.81, align: "left" }
    ];
    
    cities.forEach(city => {
        city.x = Math.cos(city.lon) * Math.cos(city.lat);
        city.y = Math.sin(city.lat);
        city.z = Math.sin(city.lon) * Math.cos(city.lat);
    });

    const extraDestinations = [
        { name: "Beijing", lat: 0.70, lon: 2.03 },
        { name: "Tokyo", lat: 0.62, lon: 2.44 },
        { name: "Jakarta", lat: -0.10, lon: 1.86 },
        { name: "Manila", lat: 0.25, lon: 2.11 }
    ];
    extraDestinations.forEach(dest => {
        dest.x = Math.cos(dest.lon) * Math.cos(dest.lat);
        dest.y = Math.sin(dest.lat);
        dest.z = Math.sin(dest.lon) * Math.cos(dest.lat);
    });

    const arcs = [
        { from: "Delhi", to: "Chnnalari" },
        { from: "Mumbai", to: "Chnnalari" },
        { from: "Bengaluru", to: "Chnnalari" },
        { from: "Chennai", to: "Chnnalari" },
        { from: "Kolkata", to: "Chnnalari" },
        { from: "Delhi", to: extraDestinations[0] }, // Beijing
        { from: "Mumbai", to: extraDestinations[1] }, // Tokyo
        { from: "Kolkata", to: extraDestinations[0] }, // Beijing
        { from: "Chennai", to: extraDestinations[2] }, // Jakarta
        { from: "Bengaluru", to: extraDestinations[3] } // Manila
    ];

    function renderGlobe() {
        const dpr = window.devicePixelRatio || 1;
        canvas.width = window.innerWidth * dpr;
        canvas.height = window.innerHeight * dpr;
        ctx.scale(dpr, dpr);
        
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;
        ctx.clearRect(0, 0, screenWidth, screenHeight);
        
        // 1. Draw Solid Ocean Base Sphere representing water body
        const sphereGrad = ctx.createRadialGradient(
            globeCenter.x - globeRadius * 0.15, globeCenter.y - globeRadius * 0.15, globeRadius * 0.1,
            globeCenter.x, globeCenter.y, globeRadius
        );
        sphereGrad.addColorStop(0, "rgb(15, 45, 80)"); // Brightened center highlight for 3D look
        sphereGrad.addColorStop(0.5, "rgb(11, 37, 69)"); // Standard deep navy
        sphereGrad.addColorStop(0.9, "rgb(7, 24, 46)"); // Dark shaded border
        sphereGrad.addColorStop(1.0, "rgba(5, 17, 32, 0.95)"); // Very sharp dark edge
        
        ctx.fillStyle = sphereGrad;
        ctx.beginPath();
        ctx.arc(globeCenter.x, globeCenter.y, globeRadius, 0, 2 * Math.PI);
        ctx.fill();

        // Subtle outer atmosphere glow
        const glowGrad = ctx.createRadialGradient(
            globeCenter.x, globeCenter.y, globeRadius * 0.95,
            globeCenter.x, globeCenter.y, globeRadius * 1.05
        );
        glowGrad.addColorStop(0, "rgba(11, 37, 69, 0.4)");
        glowGrad.addColorStop(0.5, "rgba(20, 55, 110, 0.15)");
        glowGrad.addColorStop(1.0, "rgba(20, 55, 110, 0)");
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(globeCenter.x, globeCenter.y, globeRadius * 1.05, 0, 2 * Math.PI);
        ctx.fill();
        
        // Smooth interpolation to target rotation
        rotationY += (targetRotationY - rotationY) * 0.08;
        rotationX += (targetRotationX - rotationX) * 0.08;
        
        // Continuous rotation
        targetRotationY += 0.0018;
        
        const cosY = Math.cos(rotationY);
        const sinY = Math.sin(rotationY);
        const cosX = Math.cos(rotationX);
        const sinX = Math.sin(rotationX);
        
        // Project all points
        const projected = [];
        const visibleParticles = [];
        const cameraDistance = 2.4;
        
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            
            // Rotate Y
            let x1 = p.x * cosY - p.z * sinY;
            let z1 = p.x * sinY + p.z * cosY;
            
            // Rotate X
            let y2 = p.y * cosX - z1 * sinX;
            let z2 = p.y * sinX + z1 * cosX;
            
            // Project
            const perspective = 1 / (cameraDistance - z2);
            const screenX = globeCenter.x + x1 * globeRadius * perspective;
            const screenY = globeCenter.y + y2 * globeRadius * perspective;
            
            projected.push({ x: screenX, y: screenY, z: z2 });
            
            // Filter visible ones (front hemisphere)
            if (z2 >= -0.15) {
                visibleParticles.push({
                    x: screenX,
                    y: screenY,
                    z: z2,
                    index: i
                });
            }
        }
        
        // Draw mesh wireframe for land connections
        for (let c = 0; c < connections.length; c++) {
            const conn = connections[c];
            const proj1 = projected[conn.i];
            const proj2 = projected[conn.j];
            
            if (proj1.z >= -0.15 && proj2.z >= -0.15) {
                let baseAlpha = 0.06;
                if (conn.isIndiaConn) baseAlpha = 0.35;
                else if (conn.isAsiaConn) baseAlpha = 0.16;
                
                const depthFactor = (proj1.z + proj2.z + 0.3) / 2.3; // depth-based opacity
                const alpha = Math.max(0, baseAlpha * depthFactor);
                
                if (conn.isIndiaConn) {
                    ctx.strokeStyle = `rgba(245, 158, 11, ${alpha})`;
                } else if (conn.isAsiaConn) {
                    ctx.strokeStyle = `rgba(225, 29, 72, ${alpha})`;
                } else {
                    ctx.strokeStyle = `rgba(230, 235, 245, ${alpha})`;
                }
                
                ctx.lineWidth = conn.isIndiaConn ? 0.65 : 0.4;
                ctx.beginPath();
                ctx.moveTo(proj1.x, proj1.y);
                ctx.lineTo(proj2.x, proj2.y);
                ctx.stroke();
            }
        }
        
        // Sort visible particles by Z depth (from back to front) so overlap is correct
        visibleParticles.sort((a, b) => a.z - b.z);
        
        // Draw particles
        for (let i = 0; i < visibleParticles.length; i++) {
            const vp = visibleParticles[i];
            const orig = particles[vp.index];
            const depthFactor = (vp.z + 0.15) / 1.15; // normalize [0, 1] for visible range
            
            // Ultra-fine, razor-sharp dot sizes
            let baseSize = 0.45;
            let scaleMultiplier = 0.65;
            
            if (orig.region === "india") {
                baseSize = 0.7;
                scaleMultiplier = 1.0;
            } else if (orig.region === "asia") {
                baseSize = 0.55;
                scaleMultiplier = 0.8;
            } else if (orig.region === "other-land") {
                baseSize = 0.45;
                scaleMultiplier = 0.7;
            } else { // ocean
                baseSize = 0.32;
                scaleMultiplier = 0.45;
            }
            
            const size = baseSize + depthFactor * scaleMultiplier;
            
            // Opacity
            let baseAlpha = 0.2;
            let depthSpan = 0.65;
            
            if (orig.region === "india") {
                baseAlpha = 0.65;
                depthSpan = 0.35;
            } else if (orig.region === "asia") {
                baseAlpha = 0.45;
                depthSpan = 0.5;
            } else if (orig.region === "other-land") {
                baseAlpha = 0.3;
                depthSpan = 0.6;
            } else { // ocean
                baseAlpha = 0.12;
                depthSpan = 0.22;
            }
            
            const alpha = baseAlpha + depthFactor * depthSpan;
            
            let color;
            if (orig.region === "india") {
                color = `rgba(245, 158, 11, ${alpha})`;
            } else if (orig.region === "asia") {
                color = `rgba(225, 29, 72, ${alpha})`;
            } else if (orig.region === "other-land") {
                color = `rgba(240, 244, 255, ${alpha})`;
            } else {
                color = `rgba(74, 157, 255, ${alpha * 0.75})`; // Glowing blue ocean dots
            }
            
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(vp.x, vp.y, size, 0, 2 * Math.PI);
            ctx.fill();
            
            // Subtle glow for front-most India/Asia points
            if (depthFactor > 0.82) {
                if (orig.region === "india") {
                    ctx.fillStyle = `rgba(251, 191, 36, ${alpha * 0.38})`;
                    ctx.beginPath();
                    ctx.arc(vp.x, vp.y, size * 2.2, 0, 2 * Math.PI);
                    ctx.fill();
                } else if (orig.region === "asia") {
                    ctx.fillStyle = `rgba(225, 29, 72, ${alpha * 0.28})`;
                    ctx.beginPath();
                    ctx.arc(vp.x, vp.y, size * 2.2, 0, 2 * Math.PI);
                    ctx.fill();
                }
            }
        }
        
        // --- DRAW CITIES & CURVED RED ARCS ---
        // Project cities
        const projCities = [];
        cities.forEach(city => {
            const cx1 = city.x * cosY - city.z * sinY;
            const cz1 = city.x * sinY + city.z * cosY;
            const cy2 = city.y * cosX - cz1 * sinX;
            const cz2 = city.y * sinX + cz1 * cosX;
            
            projCities.push({
                name: city.name,
                x: globeCenter.x + cx1 * globeRadius * (1 / (cameraDistance - cz2)),
                y: globeCenter.y + cy2 * globeRadius * (1 / (cameraDistance - cz2)),
                z: cz2,
                align: city.align
            });
        });
        
        const projDestinations = [];
        extraDestinations.forEach(dest => {
            const cx1 = dest.x * cosY - dest.z * sinY;
            const cz1 = dest.x * sinY + dest.z * cosY;
            const cy2 = dest.y * cosX - cz1 * sinX;
            const cz2 = dest.y * sinX + cz1 * cosX;
            
            projDestinations.push({
                name: dest.name,
                x: globeCenter.x + cx1 * globeRadius * (1 / (cameraDistance - cz2)),
                y: globeCenter.y + cy2 * globeRadius * (1 / (cameraDistance - cz2)),
                z: cz2
            });
        });
        
        // Draw curved arcs
        arcs.forEach(arc => {
            const fromCity = projCities.find(c => c.name === arc.from);
            if (!fromCity) return;
            
            let toCity = typeof arc.to === "string" ? projCities.find(c => c.name === arc.to) : null;
            if (!toCity && typeof arc.to !== "string") {
                toCity = projDestinations.find(d => d.name === arc.to.name);
            }
            if (!toCity) return;
            
            // Only draw arc if both cities are on the visible side of the globe
            if (fromCity.z > -0.15 && toCity.z > -0.15) {
                // Find 3D control point pulled outward for height
                const fromRaw = cities.find(c => c.name === arc.from);
                const toRaw = typeof arc.to === "string" ? cities.find(c => c.name === arc.to) : arc.to;
                
                const mx = (fromRaw.x + toRaw.x) / 2;
                const my = (fromRaw.y + toRaw.y) / 2;
                const mz = (fromRaw.z + toRaw.z) / 2;
                
                const len = Math.sqrt(mx*mx + my*my + mz*mz);
                // height of the curve
                const hx = (mx / len) * 1.32;
                const hy = (my / len) * 1.32;
                const hz = (mz / len) * 1.32;
                
                // Rotate control point
                const cx1 = hx * cosY - hz * sinY;
                const cz1 = hx * sinY + hz * cosY;
                const cy2 = hy * cosX - cz1 * sinX;
                const cz2 = hy * sinX + cz1 * cosX;
                
                const cp = 1 / (cameraDistance - cz2);
                const csx = globeCenter.x + cx1 * globeRadius * cp;
                const csy = globeCenter.y + cy2 * globeRadius * cp;
                
                const alpha = 0.22 * ((fromCity.z + toCity.z) / 2 + 1.15) * 0.8;
                
                // Draw glow line
                ctx.strokeStyle = `rgba(225, 29, 72, ${alpha * 0.25})`;
                ctx.lineWidth = 2.8;
                ctx.beginPath();
                ctx.moveTo(fromCity.x, fromCity.y);
                ctx.quadraticCurveTo(csx, csy, toCity.x, toCity.y);
                ctx.stroke();
                
                // Draw bright core line
                ctx.strokeStyle = `rgba(225, 29, 72, ${alpha * 0.95})`;
                ctx.lineWidth = 0.95;
                ctx.beginPath();
                ctx.moveTo(fromCity.x, fromCity.y);
                ctx.quadraticCurveTo(csx, csy, toCity.x, toCity.y);
                ctx.stroke();
            }
        });
        
        // Draw city dots and labels
        projCities.forEach(city => {
            if (city.z > 0) {
                // City circle
                ctx.fillStyle = "#ffffff";
                ctx.strokeStyle = "rgba(122, 28, 40, 0.85)";
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.arc(city.x, city.y, 3, 0, 2 * Math.PI);
                ctx.fill();
                ctx.stroke();
                
                // Text label
                ctx.fillStyle = "#0B2545"; // Deep trust navy
                ctx.font = "bold 9.5px sans-serif";
                ctx.textAlign = city.align === "left" ? "left" : "right";
                ctx.textBaseline = "middle";
                
                // Soft outline
                ctx.strokeStyle = "#ffffff";
                ctx.lineWidth = 3.5;
                const offset = city.align === "left" ? 6 : -6;
                ctx.strokeText(city.name, city.x + offset, city.y);
                ctx.fillText(city.name, city.x + offset, city.y);
            }
        });
        
        requestAnimationFrame(renderGlobe);
    }
    
    // Start Render Loop
    requestAnimationFrame(renderGlobe);

    // 4. Scroll Tracking
    window.addEventListener("scroll", () => {
        const scrollTop = window.scrollY;
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        const scrollFraction = maxScroll > 0 ? scrollTop / maxScroll : 0;

        // Map scroll directly to target Y/X rotation
        targetRotationY = scrollFraction * Math.PI * 4;
        targetRotationX = 0.2 + scrollFraction * 0.4;
    });

    // Handle Resize
    window.addEventListener("resize", () => {
        updateGlobeDimensions();
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
