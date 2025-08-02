// Portfolio JavaScript - Cleaned and Organized
class PortfolioApp {
    constructor() {
        this.header = null;
        this.mobileMenuToggle = null;
        this.navContainer = null;
        this.accessibilityToggle = null;
        this.accessibilityPanel = null;
        this.accessibilityOptions = {};
        
        this.init();
    }

    init() {
        document.addEventListener('DOMContentLoaded', () => {
            this.cacheElements();
            this.bindEvents();
            this.loadAccessibilityPreferences();
            this.setupIntersectionObserver();
            this.respectSystemPreferences();
            
            // Initialize neural network after a short delay
            setTimeout(() => this.createNeuralNetwork(), 500);
        });
    }

    cacheElements() {
        this.header = document.querySelector('header');
        this.mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
        this.navContainer = document.getElementById('navContainer');
        this.accessibilityToggle = document.getElementById('accessibilityToggle');
        this.accessibilityPanel = document.getElementById('accessibilityPanel');
        
        // Cache accessibility option buttons
        this.accessibilityOptions = {
            highContrast: {
                desktop: document.getElementById('highContrastToggle'),
                mobile: document.getElementById('mobileHighContrastToggle')
            },
            largeText: {
                desktop: document.getElementById('largeTextToggle'),
                mobile: document.getElementById('mobileLargeTextToggle')
            },
            reducedMotion: {
                desktop: document.getElementById('reducedMotionToggle'),
                mobile: document.getElementById('mobileReducedMotionToggle')
            }
        };
    }

    bindEvents() {
        // Header scroll effect
        window.addEventListener('scroll', () => this.handleScroll());
        
        // Mobile menu toggle
        if (this.mobileMenuToggle) {
            this.mobileMenuToggle.addEventListener('click', () => this.toggleMobileMenu());
        }
        
        // Desktop accessibility panel
        if (this.accessibilityToggle && this.accessibilityPanel) {
            this.accessibilityToggle.addEventListener('click', () => this.toggleAccessibilityPanel());
        }
        
        // Accessibility option handlers
        this.bindAccessibilityOptions();
        
        // Smooth scrolling
        this.bindSmoothScrolling();
        
        // Keyboard navigation
        document.addEventListener('keydown', (e) => this.handleKeydown(e));
        
        // Click outside to close panels
        document.addEventListener('click', (e) => this.handleOutsideClick(e));
        
        // Window resize for neural network
        window.addEventListener('resize', () => this.handleResize());
    }

    handleScroll() {
        if (window.scrollY > 50) {
            this.header.classList.add('scrolled');
        } else {
            this.header.classList.remove('scrolled');
        }
    }

    toggleMobileMenu() {
        const isExpanded = this.mobileMenuToggle.getAttribute('aria-expanded') === 'true';
        
        this.mobileMenuToggle.classList.toggle('active');
        this.navContainer.classList.toggle('active');
        
        this.mobileMenuToggle.setAttribute('aria-expanded', !isExpanded);
        
        if (!isExpanded) {
            const firstLink = this.navContainer.querySelector('a');
            if (firstLink) firstLink.focus();
        }
    }

    toggleAccessibilityPanel() {
        const isHidden = this.accessibilityPanel.getAttribute('aria-hidden') === 'true';
        
        this.accessibilityPanel.classList.toggle('active');
        this.accessibilityPanel.setAttribute('aria-hidden', !isHidden);
        
        if (!isHidden) {
            const firstButton = this.accessibilityPanel.querySelector('.option-btn');
            if (firstButton) firstButton.focus();
        }
    }

    bindAccessibilityOptions() {
        Object.entries(this.accessibilityOptions).forEach(([option, buttons]) => {
            [buttons.desktop, buttons.mobile].forEach(button => {
                if (button) {
                    button.addEventListener('click', () => {
                        const isPressed = button.getAttribute('aria-pressed') === 'true';
                        this.toggleAccessibilityOption(option, !isPressed);
                    });
                }
            });
        });
    }

    toggleAccessibilityOption(option, enable) {
        const buttons = this.accessibilityOptions[option];
        const body = document.body;
        
        // Update both desktop and mobile buttons
        [buttons.desktop, buttons.mobile].forEach(button => {
            if (button) {
                button.setAttribute('aria-pressed', enable);
            }
        });
        
        // Apply CSS class
        const className = option.replace(/([A-Z])/g, '-$1').toLowerCase();
        if (enable) {
            body.classList.add(className);
        } else {
            body.classList.remove(className);
        }
        
        // Save preference
        localStorage.setItem(`accessibility_${option}`, enable);
        
        // Announce change
        this.announceToScreenReader(`${option.replace(/([A-Z])/g, ' $1')} ${enable ? 'enabled' : 'disabled'}`);
    }

    loadAccessibilityPreferences() {
        Object.keys(this.accessibilityOptions).forEach(option => {
            const saved = localStorage.getItem(`accessibility_${option}`);
            if (saved === 'true') {
                this.toggleAccessibilityOption(option, true);
            }
        });
    }

    announceToScreenReader(message) {
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'polite');
        announcement.setAttribute('aria-atomic', 'true');
        announcement.style.cssText = `
            position: absolute;
            left: -10000px;
            width: 1px;
            height: 1px;
            overflow: hidden;
        `;
        announcement.textContent = message;
        
        document.body.appendChild(announcement);
        
        setTimeout(() => {
            if (document.body.contains(announcement)) {
                document.body.removeChild(announcement);
            }
        }, 1000);
    }

    bindSmoothScrolling() {
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', (e) => {
                e.preventDefault();
                
                const targetId = anchor.getAttribute('href').substring(1);
                const targetElement = document.getElementById(targetId);
                
                if (targetElement) {
                    const headerHeight = this.header.offsetHeight;
                    const targetPosition = targetElement.offsetTop - headerHeight - 40;
                    
                    window.scrollTo({
                        top: Math.max(0, targetPosition),
                        behavior: document.body.classList.contains('reduced-motion') ? 'auto' : 'smooth'
                    });
                    
                    // Close mobile menu if open
                    if (this.navContainer.classList.contains('active')) {
                        this.toggleMobileMenu();
                    }
                    
                    // Focus management for accessibility
                    targetElement.setAttribute('tabindex', '-1');
                    targetElement.focus();
                    targetElement.addEventListener('blur', () => {
                        targetElement.removeAttribute('tabindex');
                    }, { once: true });
                }
            });
        });
    }

    handleKeydown(e) {
        if (e.key === 'Escape') {
            if (this.accessibilityPanel && this.accessibilityPanel.classList.contains('active')) {
                this.accessibilityPanel.classList.remove('active');
                this.accessibilityPanel.setAttribute('aria-hidden', 'true');
                this.accessibilityToggle.focus();
            }
            
            if (this.navContainer.classList.contains('active')) {
                this.toggleMobileMenu();
                this.mobileMenuToggle.focus();
            }
        }
    }

    handleOutsideClick(e) {
        // Close accessibility panel
        if (this.accessibilityToggle && this.accessibilityPanel && 
            !this.accessibilityToggle.contains(e.target) && 
            !this.accessibilityPanel.contains(e.target)) {
            this.accessibilityPanel.classList.remove('active');
            this.accessibilityPanel.setAttribute('aria-hidden', 'true');
        }
        
        // Close mobile menu
        if (this.mobileMenuToggle && this.navContainer &&
            !this.mobileMenuToggle.contains(e.target) && 
            !this.navContainer.contains(e.target)) {
            if (this.navContainer.classList.contains('active')) {
                this.toggleMobileMenu();
            }
        }
    }

    setupIntersectionObserver() {
        const cards = document.querySelectorAll('.project-card, .skill-category, .about-card');
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }
            });
        }, {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        });

        cards.forEach(card => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(20px)';
            card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
            observer.observe(card);
        });
    }

    respectSystemPreferences() {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            this.toggleAccessibilityOption('reducedMotion', true);
        }
        
        if (window.matchMedia('(prefers-contrast: high)').matches) {
            this.toggleAccessibilityOption('highContrast', true);
        }
    }

    createNeuralNetwork() {
        const svg = document.querySelector('.network-svg');
        if (!svg) return;
        
        // Use viewport dimensions for responsive design
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        svg.setAttribute('viewBox', `0 0 ${viewportWidth} ${viewportHeight}`);
        
        const nodes = [];
        const connections = [];
        
        // Responsive node count based on screen size
        const nodeCount = Math.floor(viewportWidth / 35);
        const connectionDistance = 150;
        
        // Create nodes
        for (let i = 0; i < nodeCount; i++) {
            const node = {
                x: Math.random() * viewportWidth,
                y: Math.random() * viewportHeight,
                vx: (Math.random() - 0.5) * 0.2,
                vy: (Math.random() - 0.5) * 0.2
            };
            nodes.push(node);
            
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', node.x);
            circle.setAttribute('cy', node.y);
            circle.setAttribute('r', '1.5');
            circle.setAttribute('fill', '#00ffff');
            circle.setAttribute('filter', 'url(#glow)');
            circle.setAttribute('opacity', '0.7');
            svg.appendChild(circle);
        }
        
        // Create connections
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const distance = Math.sqrt(
                    Math.pow(nodes[i].x - nodes[j].x, 2) + 
                    Math.pow(nodes[i].y - nodes[j].y, 2)
                );
                
                if (distance < connectionDistance) {
                    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                    line.setAttribute('x1', nodes[i].x);
                    line.setAttribute('y1', nodes[i].y);
                    line.setAttribute('x2', nodes[j].x);
                    line.setAttribute('y2', nodes[j].y);
                    line.setAttribute('stroke', '#00ff00');
                    line.setAttribute('stroke-width', '0.8');
                    line.setAttribute('opacity', Math.max(0.08, 0.6 - distance / connectionDistance));
                    svg.appendChild(line);
                    connections.push({ line, nodeA: i, nodeB: j });
                }
            }
        }
        
        // Animation loop
        const animate = () => {
            const circles = svg.querySelectorAll('circle');
            const lines = svg.querySelectorAll('line');
            
            nodes.forEach((node, i) => {
                node.x += node.vx;
                node.y += node.vy;
                
                if (node.x < 0 || node.x > viewportWidth) node.vx *= -1;
                if (node.y < 0 || node.y > viewportHeight) node.vy *= -1;
                
                if (circles[i]) {
                    circles[i].setAttribute('cx', node.x);
                    circles[i].setAttribute('cy', node.y);
                }
            });
            
            connections.forEach((conn, i) => {
                const nodeA = nodes[conn.nodeA];
                const nodeB = nodes[conn.nodeB];
                
                if (lines[i]) {
                    lines[i].setAttribute('x1', nodeA.x);
                    lines[i].setAttribute('y1', nodeA.y);
                    lines[i].setAttribute('x2', nodeB.x);
                    lines[i].setAttribute('y2', nodeB.y);
                }
            });
            
            requestAnimationFrame(animate);
        };
        
        animate();
    }

    handleResize() {
        // Recreate neural network on resize
        const svg = document.querySelector('.network-svg');
        if (svg) {
            svg.innerHTML = svg.querySelector('defs').outerHTML; // Keep the defs
            setTimeout(() => this.createNeuralNetwork(), 100);
        }
    }
}

// Initialize the portfolio app
new PortfolioApp();