// ============================================
// THRONE WARS - Jeu d'Action Médiéval
// Combat en Temps Réel avec Mouvements
// ============================================

// Configuration du jeu
const GameConfig = {
    canvasWidth: window.innerWidth,
    canvasHeight: window.innerHeight,
    gravity: 0.5,
    friction: 0.9,
    gameSpeed: 60
};

// Variables globales
let canvas, ctx;
let gameRunning = false;
let lastTime = 0;
let keys = {};
let touchJoystick = { x: 0, y: 0, active: false };
let selectedCharacter = 'knight';
let currentLevel = 1;
let score = 0;
let combo = 0;
let comboTimeout = null;

// Classes du jeu
class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 50;
        this.height = 80;
        this.velocity = { x: 0, y: 0 };
        this.speed = 5;
        this.jumpForce = -15;
        this.grounded = false;
        this.facing = 'right';
        
        // Statistiques
        this.maxHealth = 100;
        this.health = this.maxHealth;
        this.maxStamina = 100;
        this.stamina = this.maxStamina;
        this.staminaRegen = 0.5;
        
        // Combat
        this.attacking = false;
        this.attackCooldown = 0;
        this.blocking = false;
        this.dodging = false;
        this.dodgeCooldown = 0;
        this.invincible = false;
        this.invincibilityTime = 0;
        
        // Armes
        this.weapons = [
            { name: "Épée", damage: 15, range: 60, cooldown: 20, icon: "⚔️" },
            { name: "Hache", damage: 25, range: 50, cooldown: 30, icon: "🪓" },
            { name: "Arc", damage: 20, range: 300, ammo: 10, maxAmmo: 10, cooldown: 15, icon: "🏹" }
        ];
        this.currentWeapon = 0;
        this.attackAnimation = 0;
        
        // Animation
        this.animationFrame = 0;
        this.animationSpeed = 0.2;
        
        // Caractéristiques selon la classe
        this.setClass(selectedCharacter);
    }
    
    setClass(className) {
        switch(className) {
            case 'knight':
                this.maxHealth = 150;
                this.health = 150;
                this.speed = 4;
                this.weapons[0].damage = 18;
                break;
            case 'berserker':
                this.maxHealth = 120;
                this.health = 120;
                this.speed = 5.5;
                this.weapons[1].damage = 30;
                this.staminaRegen = 0.8;
                break;
            case 'archer':
                this.maxHealth = 100;
                this.health = 100;
                this.speed = 6;
                this.weapons[2].damage = 25;
                this.weapons[2].maxAmmo = 15;
                this.weapons[2].ammo = 15;
                break;
        }
        this.health = this.maxHealth;
        this.stamina = this.maxStamina;
    }
    
    update(deltaTime) {
        // Mouvement
        this.handleMovement();
        
        // Physique
        this.velocity.y += GameConfig.gravity;
        this.velocity.x *= GameConfig.friction;
        this.velocity.y *= GameConfig.friction;
        
        // Collisions avec les bords
        if (this.x < 0) {
            this.x = 0;
            this.velocity.x = 0;
        }
        if (this.x + this.width > GameConfig.canvasWidth) {
            this.x = GameConfig.canvasWidth - this.width;
            this.velocity.x = 0;
        }
        if (this.y + this.height > GameConfig.canvasHeight - 100) {
            this.y = GameConfig.canvasHeight - 100 - this.height;
            this.velocity.y = 0;
            this.grounded = true;
        } else {
            this.grounded = false;
        }
        
        // Appliquer la vélocité
        this.x += this.velocity.x;
        this.y += this.velocity.y;
        
        // Régénération d'endurance
        if (this.stamina < this.maxStamina && !this.blocking && !this.dodging) {
            this.stamina += this.staminaRegen;
            if (this.stamina > this.maxStamina) this.stamina = this.maxStamina;
        }
        
        // Gestion des cooldowns
        if (this.attackCooldown > 0) this.attackCooldown--;
        if (this.dodgeCooldown > 0) this.dodgeCooldown--;
        if (this.invincibilityTime > 0) {
            this.invincibilityTime--;
            this.invincible = true;
        } else {
            this.invincible = false;
        }
        
        // Animation d'attaque
        if (this.attacking && this.attackAnimation < 20) {
            this.attackAnimation += 1;
        } else {
            this.attacking = false;
            this.attackAnimation = 0;
        }
        
        // Animation
        if (Math.abs(this.velocity.x) > 0.5 || Math.abs(this.velocity.y) > 0.5) {
            this.animationFrame += this.animationSpeed;
        }
        
        // Mettre à jour l'UI
        updatePlayerUI();
    }
    
    handleMovement() {
        let moveX = 0;
        let moveY = 0;
        
        // Contrôles clavier
        if (keys['ArrowLeft'] || keys['a'] || keys['A']) moveX -= 1;
        if (keys['ArrowRight'] || keys['d'] || keys['D']) moveX += 1;
        
        // Joystick tactile
        if (touchJoystick.active) {
            moveX += touchJoystick.x;
            moveY += touchJoystick.y;
        }
        
        // Saut
        if ((keys[' '] || keys['ArrowUp'] || keys['w'] || keys['W'] || moveY < -0.3) && this.grounded) {
            this.velocity.y = this.jumpForce;
            this.grounded = false;
        }
        
        // Appliquer le mouvement
        if (moveX !== 0) {
            this.velocity.x = moveX * this.speed;
            this.facing = moveX > 0 ? 'right' : 'left';
        }
    }
    
    attack(enemies) {
        if (this.attackCooldown > 0 || this.attacking) return;
        
        const weapon = this.weapons[this.currentWeapon];
        
        // Vérifier les munitions pour l'arc
        if (weapon.name === "Arc" && weapon.ammo <= 0) {
            showCombatText("Plus de flèches !", this.x, this.y - 50);
            return;
        }
        
        this.attacking = true;
        this.attackCooldown = weapon.cooldown;
        
        if (weapon.name === "Arc") {
            weapon.ammo--;
            createArrow(this);
        } else {
            // Attaque au corps à corps
            const attackRect = this.getAttackHitbox();
            
            enemies.forEach(enemy => {
                if (enemy.isAlive() && checkCollision(attackRect, enemy)) {
                    const damage = weapon.damage + Math.floor(Math.random() * 5);
                    enemy.takeDamage(damage, this);
                    
                    // Effet d'impact
                    createBloodEffect(enemy.x + enemy.width/2, enemy.y + enemy.height/2);
                    screenShake(5);
                    
                    // Combo
                    addCombo();
                }
            });
        }
        
        // Son d'attaque
        playSound('swing');
    }
    
    getAttackHitbox() {
        const weapon = this.weapons[this.currentWeapon];
        const range = weapon.range;
        
        if (this.facing === 'right') {
            return {
                x: this.x + this.width,
                y: this.y + this.height/2 - 20,
                width: range,
                height: 40
            };
        } else {
            return {
                x: this.x - range,
                y: this.y + this.height/2 - 20,
                width: range,
                height: 40
            };
        }
    }
    
    block() {
        if (this.stamina >= 10 && !this.blocking) {
            this.blocking = true;
            this.stamina -= 2;
        }
        
        if (this.stamina <= 0) {
            this.blocking = false;
        }
    }
    
    dodge() {
        if (this.dodgeCooldown === 0 && this.stamina >= 30) {
            this.dodging = true;
            this.stamina -= 30;
            this.dodgeCooldown = 60;
            this.invincible = true;
            this.invincibilityTime = 20;
            
            // Boost de vitesse
            const dodgeForce = this.facing === 'right' ? 15 : -15;
            this.velocity.x = dodgeForce;
            
            // Effet visuel
            createDustEffect(this.x + this.width/2, this.y + this.height);
            playSound('dodge');
            
            setTimeout(() => {
                this.dodging = false;
            }, 300);
        }
    }
    
    takeDamage(amount) {
        if (this.invincible || this.dodging) return;
        
        // Réduction des dégâts si on bloque
        if (this.blocking) {
            amount *= 0.3;
            createBlockEffect(this.x + this.width/2, this.y + this.height/2);
            playSound('block');
        } else {
            createBloodEffect(this.x + this.width/2, this.y + this.height/2);
            screenShake(10);
            playSound('hit');
        }
        
        this.health -= amount;
        this.invincible = true;
        this.invincibilityTime = 30;
        
        // Popup de dégâts
        showDamagePopup(amount, this.x + this.width/2, this.y);
        
        if (this.health <= 0) {
            this.die();
        }
    }
    
    die() {
        gameRunning = false;
        showGameOver();
        playSound('death');
    }
    
    switchWeapon() {
        this.currentWeapon = (this.currentWeapon + 1) % this.weapons.length;
        playSound('switch');
    }
    
    reload() {
        const weapon = this.weapons[this.currentWeapon];
        if (weapon.name === "Arc" && weapon.ammo < weapon.maxAmmo) {
            weapon.ammo = weapon.maxAmmo;
            showCombatText("Arc rechargé !", this.x, this.y - 50);
            playSound('reload');
        }
    }
    
    draw() {
        // Dessiner le joueur avec animation
        ctx.save();
        
        if (this.invincible && this.invincibilityTime % 6 < 3) {
            ctx.globalAlpha = 0.5;
        }
        
        // Corps
        ctx.fillStyle = this.blocking ? '#2a4d69' : (this.dodging ? '#d4af37' : '#8b0000');
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        // Tête
        ctx.fillStyle = '#f5e9d0';
        ctx.fillRect(this.x + 10, this.y, 30, 30);
        
        // Animation de course
        if (Math.abs(this.velocity.x) > 1) {
            const legOffset = Math.sin(this.animationFrame) * 10;
            ctx.fillStyle = '#5a0000';
            ctx.fillRect(this.x, this.y + this.height - 10, 15, 10 + legOffset);
            ctx.fillRect(this.x + this.width - 15, this.y + this.height - 10, 15, 10 - legOffset);
        }
        
        // Arme
        this.drawWeapon();
        
        // Effet de blocage
        if (this.blocking) {
            ctx.strokeStyle = '#1e90ff';
            ctx.lineWidth = 3;
            ctx.strokeRect(this.x - 10, this.y - 10, this.width + 20, this.height + 20);
        }
        
        ctx.restore();
    }
    
    drawWeapon() {
        const weapon = this.weapons[this.currentWeapon];
        ctx.save();
        
        if (this.facing === 'left') {
            ctx.scale(-1, 1);
            ctx.translate(-GameConfig.canvasWidth, 0);
        }
        
        const weaponX = this.facing === 'right' ? 
            this.x + this.width : 
            GameConfig.canvasWidth - this.x;
        
        const weaponY = this.y + this.height/2;
        
        // Animation d'attaque
        let angle = 0;
        if (this.attacking) {
            angle = (this.attackAnimation / 20) * Math.PI;
            if (this.facing === 'left') angle = -angle;
        }
        
        ctx.translate(weaponX, weaponY);
        ctx.rotate(angle);
        
        // Dessiner l'arme
        ctx.fillStyle = '#5a5a5a';
        if (weapon.name === "Épée") {
            ctx.fillRect(0, -5, 60 + this.attackAnimation, 10);
            ctx.fillStyle = '#d4af37';
            ctx.fillRect(50 + this.attackAnimation, -8, 10, 16);
        } else if (weapon.name === "Hache") {
            ctx.fillRect(0, -8, 50 + this.attackAnimation, 16);
            ctx.fillStyle = '#8b0000';
            ctx.fillRect(40 + this.attackAnimation, -15, 20, 30);
        } else if (weapon.name === "Arc") {
            ctx.strokeStyle = '#8b0000';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(0, 0, 40, 0, Math.PI);
            ctx.stroke();
            
            // Flèche si visée
            if (this.attacking && this.attackAnimation > 10) {
                ctx.fillStyle = '#d4af37';
                ctx.fillRect(40, -2, 20, 4);
                ctx.beginPath();
                ctx.moveTo(60, 0);
                ctx.lineTo(70, -5);
                ctx.lineTo(70, 5);
                ctx.fill();
            }
        }
        
        ctx.restore();
    }
}

class Enemy {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.width = 50;
        this.height = 80;
        this.velocity = { x: 0, y: 0 };
        
        // Statistiques selon le type
        switch(type) {
            case 'soldier':
                this.maxHealth = 50;
                this.speed = 2;
                this.damage = 10;
                this.color = '#2a4d69';
                break;
            case 'knight':
                this.maxHealth = 100;
                this.speed = 1.5;
                this.damage = 20;
                this.color = '#1a1a2e';
                break;
            case 'archer':
                this.maxHealth = 40;
                this.speed = 3;
                this.damage = 15;
                this.color = '#2d5a27';
                this.attackRange = 200;
                this.attackCooldown = 0;
                break;
            case 'boss':
                this.maxHealth = 300;
                this.speed = 1;
                this.damage = 30;
                this.color = '#8b0000';
                this.width = 100;
                this.height = 120;
                break;
        }
        
        this.health = this.maxHealth;
        this.alive = true;
        this.attackTimer = 0;
        this.aggroRange = 300;
        this.attackRange = 60;
        this.attacking = false;
        this.attackAnimation = 0;
    }
    
    update(player) {
        if (!this.alive) return;
        
        // AI simple
        const distance = Math.sqrt(
            Math.pow(player.x - this.x, 2) + 
            Math.pow(player.y - this.y, 2)
        );
        
        if (distance < this.aggroRange) {
            // Se déplacer vers le joueur
            const directionX = player.x - this.x;
            const directionY = player.y - this.y;
            const angle = Math.atan2(directionY, directionX);
            
            this.velocity.x = Math.cos(angle) * this.speed;
            this.velocity.y = Math.sin(angle) * this.speed;
            
            // Attaque si assez proche
            if (distance < this.attackRange && this.attackTimer <= 0) {
                this.attack(player);
                this.attackTimer = 60;
            }
            
            // Attaque à distance pour les archers
            if (this.type === 'archer' && distance < this.attackRange && this.attackCooldown <= 0) {
                this.rangedAttack(player);
                this.attackCooldown = 120;
            }
        } else {
            this.velocity.x *= 0.9;
            this.velocity.y *= 0.9;
        }
        
        // Physique
        this.velocity.y += GameConfig.gravity;
        this.x += this.velocity.x;
        this.y += this.velocity.y;
        
        // Collisions avec le sol
        if (this.y + this.height > GameConfig.canvasHeight - 100) {
            this.y = GameConfig.canvasHeight - 100 - this.height;
            this.velocity.y = 0;
        }
        
        // Cooldowns
        if (this.attackTimer > 0) this.attackTimer--;
        if (this.attackCooldown > 0) this.attackCooldown--;
        
        // Animation d'attaque
        if (this.attacking && this.attackAnimation < 15) {
            this.attackAnimation += 1;
        } else {
            this.attacking = false;
            this.attackAnimation = 0;
        }
    }
    
    attack(player) {
        this.attacking = true;
        
        // Vérifier la collision avec le joueur
        if (checkCollision(this, player)) {
            player.takeDamage(this.damage);
        }
        
        playSound('enemy_attack');
    }
    
    rangedAttack(player) {
        // Créer un projectile
        createEnemyArrow(this, player);
        playSound('bow');
    }
    
    takeDamage(amount, source) {
        this.health -= amount;
        
        // Knockback
        const directionX = this.x - source.x;
        const directionY = this.y - source.y;
        const angle = Math.atan2(directionY, directionX);
        const force = 10;
        
        this.velocity.x = Math.cos(angle) * force;
        this.velocity.y = Math.sin(angle) * force;
        
        // Popup de dégâts
        showDamagePopup(amount, this.x + this.width/2, this.y);
        
        // Effet de sang
        createBloodEffect(this.x + this.width/2, this.y + this.height/2);
        
        if (this.health <= 0) {
            this.die();
        }
    }
    
    die() {
        this.alive = false;
        score += this.type === 'boss' ? 500 : 100;
        createDeathEffect(this.x + this.width/2, this.y + this.height/2);
        playSound('enemy_death');
    }
    
    isAlive() {
        return this.alive;
    }
    
    draw() {
        if (!this.alive) return;
        
        // Corps
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        // Tête
        ctx.fillStyle = '#f5e9d0';
        ctx.fillRect(this.x + 10, this.y, this.width - 20, 30);
        
        // Barre de vie
        const healthPercent = this.health / this.maxHealth;
        ctx.fillStyle = '#8b0000';
        ctx.fillRect(this.x, this.y - 15, this.width, 10);
        ctx.fillStyle = '#00ff00';
        ctx.fillRect(this.x, this.y - 15, this.width * healthPercent, 10);
        
        // Arme selon le type
        this.drawWeapon();
    }
    
    drawWeapon() {
        ctx.save();
        
        const weaponX = this.x + this.width;
        const weaponY = this.y + this.height/2;
        
        // Animation d'attaque
        let angle = 0;
        if (this.attacking) {
            angle = (this.attackAnimation / 15) * Math.PI;
        }
        
        ctx.translate(weaponX, weaponY);
        ctx.rotate(angle);
        
        ctx.fillStyle = '#5a5a5a';
        
        switch(this.type) {
            case 'soldier':
            case 'knight':
            case 'boss':
                ctx.fillRect(0, -5, 50 + this.attackAnimation, 10);
                break;
            case 'archer':
                ctx.strokeStyle = '#2d5a27';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(0, 0, 35, 0, Math.PI);
                ctx.stroke();
                break;
        }
        
        ctx.restore();
    }
}

class Projectile {
    constructor(x, y, angle, speed, damage, isPlayer = true) {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.speed = speed;
        this.damage = damage;
        this.isPlayer = isPlayer;
        this.radius = 5;
        this.alive = true;
    }
    
    update() {
        this.x += Math.cos(this.angle) * this.speed;
        this.y += Math.sin(this.angle) * this.speed;
        
        // Collision avec les bords
        if (this.x < 0 || this.x > GameConfig.canvasWidth || 
            this.y < 0 || this.y > GameConfig.canvasHeight) {
            this.alive = false;
        }
    }
    
    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        
        if (this.isPlayer) {
            ctx.fillStyle = '#d4af37';
        } else {
            ctx.fillStyle = '#2d5a27';
        }
        
        // Corps de la flèche
        ctx.fillRect(0, -2, 20, 4);
        
        // Pointe
        ctx.fillStyle = this.isPlayer ? '#8b0000' : '#1a1a2e';
        ctx.beginPath();
        ctx.moveTo(20, 0);
        ctx.lineTo(25, -3);
        ctx.lineTo(25, 3);
        ctx.fill();
        
        // Empenne
        ctx.fillStyle = this.isPlayer ? '#2d5a27' : '#8b0000';
        ctx.fillRect(0, -3, 5, 6);
        
        ctx.restore();
    }
}

// Tableaux d'objets du jeu
let player;
let enemies = [];
let projectiles = [];
let effects = [];
let damagePopups = [];
let combatTexts = [];

// Initialisation du jeu
function initGame() {
    console.log("🎮 Initialisation du jeu d'action...");
    
    // Récupérer le canvas
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    
    // Redimensionner le canvas
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Configurer les contrôles
    setupControls();
    
    // Configurer les événements du menu
    setupMenuEvents();
    
    // Initialiser les sons (simulés pour l'instant)
    initSounds();
    
    console.log("✅ Jeu initialisé");
}

function resizeCanvas() {
    GameConfig.canvasWidth = window.innerWidth;
    GameConfig.canvasHeight = window.innerHeight;
    
    canvas.width = GameConfig.canvasWidth;
    canvas.height = GameConfig.canvasHeight;
    
    if (player) {
        // Recentrer le joueur si nécessaire
        player.x = Math.min(player.x, GameConfig.canvasWidth - player.width);
        player.y = Math.min(player.y, GameConfig.canvasHeight - 100 - player.height);
    }
}

function setupMenuEvents() {
    document.getElementById('startGameBtn').addEventListener('click', startGame);
    document.getElementById('settingsBtn').addEventListener('click', showSettings);
    document.getElementById('creditsBtn').addEventListener('click', showCredits);
    
    // Sélection de personnage
    document.querySelectorAll('.character-option').forEach(option => {
        option.addEventListener('click', () => {
            document.querySelectorAll('.character-option').forEach(o => o.classList.remove('selected'));
            option.classList.add('selected');
            selectedCharacter = option.dataset.character;
        });
    });
    
    // Sélection par défaut
    document.querySelector('.character-option[data-character="knight"]').classList.add('selected');
}

function setupControls() {
    // Contrôles clavier
    window.addEventListener('keydown', (e) => {
        keys[e.key] = true;
        
        // Changement d'arme
        if (e.key === 'e' || e.key === 'E') {
            if (player) player.switchWeapon();
        }
        
        // Recharger
        if (e.key === 'r' || e.key === 'R') {
            if (player) player.reload();
        }
    });
    
    window.addEventListener('keyup', (e) => {
        keys[e.key] = false;
    });
    
    // Contrôles tactiles
    const joystick = document.getElementById('joystickContainer');
    const joystickThumb = document.getElementById('joystickThumb');
    let joystickBounds = null;
    let touchId = null;
    
    joystick.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (touchId !== null) return;
        
        const touch = e.touches[0];
        touchId = touch.identifier;
        joystickBounds = joystick.getBoundingClientRect();
        
        touchJoystick.active = true;
    });
    
    joystick.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (!touchJoystick.active) return;
        
        for (let touch of e.touches) {
            if (touch.identifier === touchId) {
                const x = touch.clientX - joystickBounds.left - joystickBounds.width/2;
                const y = touch.clientY - joystickBounds.top - joystickBounds.height/2;
                
                const distance = Math.sqrt(x*x + y*y);
                const maxDistance = joystickBounds.width/2 - 30;
                
                if (distance > maxDistance) {
                    const angle = Math.atan2(y, x);
                    touchJoystick.x = Math.cos(angle);
                    touchJoystick.y = Math.sin(angle);
                    
                    joystickThumb.style.left = `${Math.cos(angle) * maxDistance + joystickBounds.width/2 - 30}px`;
                    joystickThumb.style.top = `${Math.sin(angle) * maxDistance + joystickBounds.height/2 - 30}px`;
                } else {
                    touchJoystick.x = x / maxDistance;
                    touchJoystick.y = y / maxDistance;
                    
                    joystickThumb.style.left = `${x + joystickBounds.width/2 - 30}px`;
                    joystickThumb.style.top = `${y + joystickBounds.height/2 - 30}px`;
                }
                break;
            }
        }
    });
    
    joystick.addEventListener('touchend', (e) => {
        e.preventDefault();
        for (let touch of e.changedTouches) {
            if (touch.identifier === touchId) {
                touchJoystick.active = false;
                touchJoystick.x = 0;
                touchJoystick.y = 0;
                touchId = null;
                
                joystickThumb.style.left = '50%';
                joystickThumb.style.top = '50%';
                break;
            }
        }
    });
    
    // Boutons d'action
    document.getElementById('attackBtn').addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (player) player.attack(enemies);
    });
    
    document.getElementById('blockBtn').addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (player) player.block();
    });
    
    document.getElementById('blockBtn').addEventListener('touchend', (e) => {
        e.preventDefault();
        if (player) player.blocking = false;
    });
    
    document.getElementById('dodgeBtn').addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (player) player.dodge();
    });
    
    document.getElementById('reloadBtn').addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (player) player.reload();
    });
    
    // Clic souris pour attaquer (desktop)
    canvas.addEventListener('mousedown', (e) => {
        if (player) player.attack(enemies);
    });
}

// Fonctions de jeu
function startGame() {
    console.log("🚀 Démarrage de la partie...");
    
    // Cacher le menu
    document.getElementById('menuScreen').style.display = 'none';
    
    // Initialiser le joueur
    player = new Player(GameConfig.canvasWidth/2 - 25, GameConfig.canvasHeight/2 - 40);
    player.setClass(selectedCharacter);
    
    // Initialiser les ennemis
    spawnEnemies();
    
    // Réinitialiser le score
    score = 0;
    combo = 0;
    
    // Démarrer la boucle de jeu
    gameRunning = true;
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
    
    // Notification de début
    showCombatText("La bataille commence !", player.x, player.y - 100);
    playSound('battle_start');
}

function spawnEnemies() {
    enemies = [];
    
    // Nombre d'ennemis selon le niveau
    const enemyCount = 5 + currentLevel * 2;
    
    for (let i = 0; i < enemyCount; i++) {
        const types = ['soldier', 'soldier', 'archer', 'knight'];
        const type = types[Math.floor(Math.random() * types.length)];
        
        // Position aléatoire mais pas trop près du joueur
        let x, y;
        do {
            x = Math.random() * (GameConfig.canvasWidth - 100) + 50;
            y = Math.random() * (GameConfig.canvasHeight - 300) + 50;
        } while (Math.abs(x - player.x) < 200 && Math.abs(y - player.y) < 200);
        
        enemies.push(new Enemy(x, y, type));
    }
    
    // Ajouter un boss tous les 3 niveaux
    if (currentLevel % 3 === 0) {
        enemies.push(new Enemy(
            GameConfig.canvasWidth - 150,
            GameConfig.canvasHeight - 220,
            'boss'
        ));
    }
}

// Boucle principale du jeu
function gameLoop(currentTime) {
    if (!gameRunning) return;
    
    const deltaTime = (currentTime - lastTime) / 16.67; // Normalisé à 60 FPS
    lastTime = currentTime;
    
    // Effacer l'écran
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, GameConfig.canvasWidth, GameConfig.canvasHeight);
    
    // Dessiner le sol
    ctx.fillStyle = '#2d1b69';
    ctx.fillRect(0, GameConfig.canvasHeight - 100, GameConfig.canvasWidth, 100);
    
    // Dessiner des détails au sol
    ctx.fillStyle = '#1a1a2e';
    for (let i = 0; i < GameConfig.canvasWidth; i += 50) {
        ctx.fillRect(i, GameConfig.canvasHeight - 100, 25, 10);
    }
    
    // Mettre à jour et dessiner le joueur
    player.update(deltaTime);
    player.draw();
    
    // Mettre à jour et dessiner les ennemis
    enemies.forEach(enemy => {
        enemy.update(player);
        enemy.draw();
    });
    
    // Mettre à jour et dessiner les projectiles
    projectiles.forEach((projectile, index) => {
        projectile.update();
        projectile.draw();
        
        // Vérifier les collisions
        if (projectile.isPlayer) {
            enemies.forEach(enemy => {
                if (enemy.isAlive() && 
                    Math.sqrt(
                        Math.pow(projectile.x - (enemy.x + enemy.width/2), 2) + 
                        Math.pow(projectile.y - (enemy.y + enemy.height/2), 2)
                    ) < enemy.width/2) {
                    enemy.takeDamage(projectile.damage, player);
                    projectile.alive = false;
                    addCombo();
                }
            });
        } else {
            if (checkProjectileCollision(projectile, player)) {
                player.takeDamage(projectile.damage);
                projectile.alive = false;
            }
        }
        
        // Supprimer les projectiles morts
        if (!projectile.alive) {
            projectiles.splice(index, 1);
        }
    });
    
    // Dessiner les effets
    effects.forEach((effect, index) => {
        effect.update();
        effect.draw();
        
        if (!effect.alive) {
            effects.splice(index, 1);
        }
    });
    
    // Dessiner les popups de dégâts
    damagePopups.forEach((popup, index) => {
        popup.y -= 1;
        popup.life--;
        
        ctx.fillStyle = `rgba(255, ${255 - popup.damage * 2}, 0, ${popup.life / 60})`;
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`-${popup.damage}`, popup.x, popup.y);
        
        if (popup.life <= 0) {
            damagePopups.splice(index, 1);
        }
    });
    
    // Dessiner les textes de combat
    combatTexts.forEach((text, index) => {
        text.y -= 0.5;
        text.life--;
        
        ctx.fillStyle = `rgba(212, 175, 55, ${text.life / 120})`;
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(text.message, text.x, text.y);
        
        if (text.life <= 0) {
            combatTexts.splice(index, 1);
        }
    });
    
    // Dessiner le score et combo
    ctx.fillStyle = '#d4af37';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Score: ${score}`, 20, 140);
    
    if (combo > 1) {
        ctx.fillStyle = '#ff4500';
        ctx.font = 'bold 48px Arial';
        ctx.fillText(`${combo} COMBO!`, GameConfig.canvasWidth/2, 100);
    }
    
    // Vérifier si tous les ennemis sont morts
    const aliveEnemies = enemies.filter(enemy => enemy.isAlive()).length;
    if (aliveEnemies === 0) {
        levelComplete();
    }
    
    // Continuer la boucle
    requestAnimationFrame(gameLoop);
}

// Fonctions utilitaires
function checkCollision(rect1, rect2) {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
}

function checkProjectileCollision(projectile, target) {
    const distance = Math.sqrt(
        Math.pow(projectile.x - (target.x + target.width/2), 2) + 
        Math.pow(projectile.y - (target.y + target.height/2), 2)
    );
    return distance < target.width/2;
}

function createBloodEffect(x, y) {
    effects.push({
        x, y,
        particles: Array.from({length: 20}, () => ({
            x: 0, y: 0,
            vx: (Math.random() - 0.5) * 10,
            vy: (Math.random() - 0.5) * 10,
            life: 60
        })),
        update() {
            this.particles.forEach(p => {
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.2;
                p.life--;
            });
            this.alive = this.particles.some(p => p.life > 0);
        },
        draw() {
            ctx.fillStyle = '#8b0000';
            this.particles.forEach(p => {
                if (p.life > 0) {
                    ctx.globalAlpha = p.life / 60;
                    ctx.fillRect(this.x + p.x, this.y + p.y, 4, 4);
                }
            });
            ctx.globalAlpha = 1;
        },
        alive: true
    });
}

function createDustEffect(x, y) {
    effects.push({
        x, y,
        particles: Array.from({length: 15}, () => ({
            x: 0, y: 0,
            vx: (Math.random() - 0.5) * 8,
            vy: (Math.random() - 0.5) * 8,
            life: 40
        })),
        update() {
            this.particles.forEach(p => {
                p.x += p.vx;
                p.y += p.vy;
                p.life--;
            });
            this.alive = this.particles.some(p => p.life > 0);
        },
        draw() {
            ctx.fillStyle = '#d4af37';
            this.particles.forEach(p => {
                if (p.life > 0) {
                    ctx.globalAlpha = p.life / 40;
                    ctx.fillRect(this.x + p.x, this.y + p.y, 3, 3);
                }
            });
            ctx.globalAlpha = 1;
        },
        alive: true
    });
}

function createBlockEffect(x, y) {
    effects.push({
        x, y,
        radius: 30,
        life: 30,
        update() {
            this.radius += 2;
            this.life--;
            this.alive = this.life > 0;
        },
        draw() {
            ctx.strokeStyle = `rgba(30, 144, 255, ${this.life / 30})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.stroke();
        },
        alive: true
    });
}

function createDeathEffect(x, y) {
    effects.push({
        x, y,
        radius: 5,
        maxRadius: 100,
        life: 30,
        update() {
            this.radius += 3;
            this.life--;
            this.alive = this.life > 0 && this.radius < this.maxRadius;
        },
        draw() {
            ctx.fillStyle = `rgba(139, 0, 0, ${this.life / 30})`;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();
        },
        alive: true
    });
}

function createArrow(shooter) {
    const angle = shooter.facing === 'right' ? 0 : Math.PI;
    const x = shooter.facing === 'right' ? 
        shooter.x + shooter.width : 
        shooter.x;
    const y = shooter.y + shooter.height/2;
    
    projectiles.push(new Projectile(
        x, y, angle, 15, shooter.weapons[shooter.currentWeapon].damage, true
    ));
}

function createEnemyArrow(shooter, target) {
    const angle = Math.atan2(
        target.y + target.height/2 - (shooter.y + shooter.height/2),
        target.x + target.width/2 - (shooter.x + shooter.width/2)
    );
    
    projectiles.push(new Projectile(
        shooter.x + shooter.width/2,
        shooter.y + shooter.height/2,
        angle, 10, shooter.damage, false
    ));
}

function showDamagePopup(damage, x, y) {
    damagePopups.push({
        damage,
        x,
        y,
        life: 60
    });
}

function showCombatText(message, x, y) {
    combatTexts.push({
        message,
        x,
        y,
        life: 120
    });
}

function screenShake(intensity) {
    canvas.classList.add('screen-shake');
    canvas.style.transform = `translate(${Math.random() * intensity - intensity/2}px, ${Math.random() * intensity - intensity/2}px)`;
    
    setTimeout(() => {
        canvas.classList.remove('screen-shake');
        canvas.style.transform = '';
    }, 300);
}

function addCombo() {
    combo++;
    
    if (comboTimeout) clearTimeout(comboTimeout);
    comboTimeout = setTimeout(() => {
        // Bonus de score pour les combos
        if (combo > 3) {
            const bonus = combo * 50;
            score += bonus;
            showCombatText(`Combo x${combo}! +${bonus}`, player.x, player.y - 80);
        }
        combo = 0;
    }, 2000);
}

function updatePlayerUI() {
    // Mettre à jour la barre de vie
    const healthPercent = player.health / player.maxHealth;
    document.getElementById('healthFill').style.width = `${healthPercent * 100}%`;
    document.getElementById('healthText').textContent = `${Math.round(player.health)}/${player.maxHealth}`;
    
    // Couleur selon la vie
    if (healthPercent > 0.5) {
        document.getElementById('healthFill').style.background = 'linear-gradient(90deg, #00ff00, #ffff00)';
    } else if (healthPercent > 0.25) {
        document.getElementById('healthFill').style.background = 'linear-gradient(90deg, #ffff00, #ff4500)';
    } else {
        document.getElementById('healthFill').style.background = 'linear-gradient(90deg, #ff4500, #ff0000)';
    }
    
    // Mettre à jour l'endurance
    const staminaPercent = player.stamina / player.maxStamina;
    document.getElementById('staminaFill').style.width = `${staminaPercent * 100}%`;
    
    // Mettre à jour les munitions
    const weapon = player.weapons[player.currentWeapon];
    document.getElementById('weaponIcon').textContent = weapon.icon;
    
    if (weapon.ammo !== undefined) {
        document.getElementById('ammoText').textContent = `${weapon.ammo}/${weapon.maxAmmo}`;
        
        // Avertissement si peu de munitions
        if (weapon.ammo < weapon.maxAmmo * 0.3) {
            document.getElementById('ammoText').style.color = '#ff0000';
        } else {
            document.getElementById('ammoText').style.color = '#ffffff';
        }
    } else {
        document.getElementById('ammoText').textContent = '∞';
        document.getElementById('ammoText').style.color = '#ffffff';
    }
}

function levelComplete() {
    showCombatText("Niveau terminé !", GameConfig.canvasWidth/2, GameConfig.canvasHeight/2);
    
    setTimeout(() => {
        currentLevel++;
        showCombatText(`Niveau ${currentLevel}`, GameConfig.canvasWidth/2, GameConfig.canvasHeight/2);
        spawnEnemies();
        player.health = player.maxHealth;
        player.stamina = player.maxStamina;
        
        // Bonus pour avoir terminé le niveau
        const levelBonus = currentLevel * 200;
        score += levelBonus;
        showCombatText(`+${levelBonus} points`, GameConfig.canvasWidth/2, GameConfig.canvasHeight/2 + 50);
    }, 2000);
}

function showGameOver() {
    // Afficher l'écran de game over
    const gameOverDiv = document.createElement('div');
    gameOverDiv.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.9);
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        color: #d4af37;
        font-family: 'Cinzel', serif;
        z-index: 1000;
    `;
    
    gameOverDiv.innerHTML = `
        <h1 style="font-size: 4rem; margin-bottom: 20px;">💀 GAME OVER 💀</h1>
        <p style="font-size: 2rem; margin-bottom: 30px;">Score final: ${score}</p>
        <p style="font-size: 1.5rem; margin-bottom: 20px; color: #c0c0c0;">Niveau atteint: ${currentLevel}</p>
        <button id="restartBtn" style="
            padding: 20px 40px;
            font-size: 1.5rem;
            background: linear-gradient(to bottom, rgba(212, 175, 55, 0.2), rgba(180, 150, 40, 0.1));
            border: 3px solid #d4af37;
            color: #d4af37;
            border-radius: 15px;
            cursor: pointer;
            margin: 10px;
            font-family: 'Cinzel', serif;
        ">REJOUER</button>
        <button id="menuBtn" style="
            padding: 20px 40px;
            font-size: 1.5rem;
            background: linear-gradient(to bottom, rgba(42, 77, 105, 0.2), rgba(30, 60, 90, 0.1));
            border: 3px solid #2a4d69;
            color: #2a4d69;
            border-radius: 15px;
            cursor: pointer;
            margin: 10px;
            font-family: 'Cinzel', serif;
        ">MENU</button>
    `;
    
    document.body.appendChild(gameOverDiv);
    
    document.getElementById('restartBtn').addEventListener('click', () => {
        document.body.removeChild(gameOverDiv);
        startGame();
    });
    
    document.getElementById('menuBtn').addEventListener('click', () => {
        document.body.removeChild(gameOverDiv);
        document.getElementById('menuScreen').style.display = 'flex';
        gameRunning = false;
        currentLevel = 1;
    });
}

// Sons (simulés pour l'exemple)
function initSounds() {
    // Dans une vraie implémentation, vous chargeriez des fichiers audio
    // Pour l'exemple, on simule juste les appels
}

function playSound(soundName) {
    // Simuler le son
    console.log(`🔊 Jouer son: ${soundName}`);
    
    // Dans une vraie implémentation:
    // const audio = new Audio(`sounds/${soundName}.mp3`);
    // audio.volume = 0.3;
    // audio.play().catch(e => console.log("Son désactivé"));
}

function showSettings() {
    alert("⚙️ PARAMÈTRES\n\n" +
          "Volume: 70%\n" +
          "Sensibilité: Normale\n" +
          "Graphiques: Haute performance\n" +
          "Contrôles: Tactile + Clavier\n\n" +
          "Ces paramètres seront configurables\n" +
          "dans une prochaine version.");
}

function showCredits() {
    alert("🎭 CRÉDITS - THRONE WARS\n\n" +
          "Jeu d'Action Médiévale\n\n" +
          "Développement:\n" +
          "• Programmation: JavaScript Canvas\n" +
          "• Graphiques: Pixel Art procédural\n" +
          "• Design: Style Game of Thrones\n\n" +
          "Contrôles:\n" +
          "• Mobile: Joystick + boutons tactiles\n" +
          "• Desktop: Clavier + souris\n\n" +
          "© 2023 - Version Action 1.0");
}

// Démarrer le jeu quand la page est chargée
window.addEventListener('load', initGame);