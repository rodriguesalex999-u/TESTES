// ========================================
// GRUPO ETEVALDA MT - VERSÃO FUNCIONAL
// ========================================

// 1. CONFIGURAÇÃO DO SUPABASE
const SUPABASE_URL = 'https://vnrfmsyanrvqqhmqyixk.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_xGLDFQarl-DhshRW0932FQ_asug0TUK';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 2. ESTADO DA APLICAÇÃO
let products = [];
let categories = [];
let cart = [];
let currentCategory = 'all';
let searchQuery = '';
let allProductsLoaded = [];
let faqs = [];
let socialProofImages = [];
let deliveryTimerInterval = null;
let currentZoomIndex = 0;
let superZoomMediaList = [];
let currentModalProduct = null;
let currentMediaList = [];
let currentMediaIndex = 0;

// Dicionários para notificações geo-localizadas
const NEIGHBORHOODS = {
    'Cuiabá': ['Centro', 'Alvorada', 'Porto', 'Duque de Caxias', 'Popular', 'Goiaba'],
    'Várzea Grande': ['Centro', 'Jardim América', 'Morada do Ouro', 'Santa Izabel', 'Planalto'],
    'Rondonópolis': ['Centro', 'Ouro Branco', 'Jardim dos Girassóis'],
    'Barra do Bugres': ['Centro', 'Setor Sul', 'Vila Operária']
};

const CUSTOMER_NAMES = ['Ana', 'Maria', 'João', 'Pedro', 'Carla', 'Lucas', 'Fernanda', 'Carlos'];
let detectedLocation = { city: 'Cuiabá', neighborhoods: NEIGHBORHOODS['Cuiabá'] };

// 3. FUNÇÕES DE CARREGAMENTO
async function loadProducts(reset = false) {
    if (reset) {
        allProductsLoaded = [];
    }

    try {
        let query = _supabase.from('products').select('*');

        if (currentCategory !== 'all') {
            query = query.eq('category_id', currentCategory).order('id', { ascending: false });
        } else {
            query = query.order('random_index');
        }

        const { data, error } = await query;
        if (error) throw error;

        if (data && data.length > 0) {
            const filteredData = data.filter(p => {
                const images = Array.isArray(p.images) ? p.images : [];
                return images.length > 0;
            });

            allProductsLoaded = reset ? filteredData : [...allProductsLoaded, ...filteredData];
        }

        renderProducts();

    } catch (error) {
        console.error('Erro ao carregar produtos:', error);
    }
}

async function loadCategories() {
    const { data } = await _supabase.from('categories').select('*').order('id');
    categories = data || [];
}

async function loadFaqs() {
    const { data } = await _supabase.from('faqs').select('*').order('order_index');
    faqs = data || [];
}

async function loadSocialProof() {
    const { data } = await _supabase
        .from('social_proof')
        .select('*')
        .eq('is_active', true)
        .order('display_order');
    
    socialProofImages = (data || []).filter(item => {
        return item.image_url && item.image_url.trim() !== '';
    });
}

// 4. FUNÇÕES DE RENDERIZAÇÃO
function renderProducts() {
    const container = document.getElementById('productsContainer');
    if (!container) return;

    let filtered = allProductsLoaded.filter(p => {
        const matchCat = currentCategory === 'all' || String(p.category_id) === String(currentCategory);
        const matchSearch = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase());
        return matchCat && matchSearch;
    });

    if (filtered.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding:40px;">Nenhum produto encontrado</p>';
        return;
    }

    container.innerHTML = filtered.map(p => {
        const images = Array.isArray(p.images) ? p.images : [];
        const hasMultipleImages = images.length > 1;
        const soldTodayHtml = p.sold_today ? '<div class="product-sold-today">Vendido Hoje</div>' : '';
        
        return `
        <div class="product-card" onclick="openProductModal(${p.id})">
            <div class="product-image" 
                 ${hasMultipleImages ? `onmouseover="hoverImage(${p.id}, 1)" onmouseout="unhoverImage(${p.id}, 0)"` : ''}>
                <img id="product-img-${p.id}" src="${images[0] || 'https://via.placeholder.com/200'}" alt="${p.name}">
                ${hasMultipleImages ? `<img id="product-img-hover-${p.id}" src="${images[1] || 'https://via.placeholder.com/200'}" alt="${p.name}" style="display:none;">` : ''}
                ${soldTodayHtml}
            </div>
            <div class="product-info">
                <h3>${p.name}</h3>
                <div class="product-price">R$ ${p.price.toFixed(2).replace('.', ',')}</div>
                <button class="btn-primary" onclick="addToCart(${p.id})">
                    <i class="fas fa-cart-plus"></i> Carrinho
                </button>
            </div>
        </div>
    `;
    }).join('');
}

function renderCategories() {
    const list = document.getElementById('categoryList');
    if (!list) return;

    list.innerHTML = '<li class="active" data-category="all">Todos</li>';

    categories.forEach(cat => {
        list.innerHTML += `<li data-category="${cat.id}">${cat.name}</li>`;
    });

    list.querySelectorAll('li').forEach(button => {
        button.addEventListener('click', () => {
            list.querySelectorAll('li').forEach(el => el.classList.remove('active'));
            button.classList.add('active');
            
            currentCategory = button.dataset.category;
            allProductsLoaded = [];
            
            const container = document.getElementById('productsContainer');
            if (container) container.innerHTML = '';
            
            loadProducts(true);
        });
    });
}

// Funções de Hover de Imagem
window.hoverImage = function(productId, hoverState) {
    const mainImg = document.getElementById(`product-img-${productId}`);
    const hoverImg = document.getElementById(`product-img-hover-${productId}`);
    
    if (mainImg && hoverImg) {
        mainImg.style.display = hoverState ? 'none' : 'block';
        hoverImg.style.display = hoverState ? 'block' : 'none';
    }
};

window.unhoverImage = function(productId, hoverState) {
    const mainImg = document.getElementById(`product-img-${productId}`);
    const hoverImg = document.getElementById(`product-img-hover-${productId}`);
    
    if (mainImg && hoverImg) {
        mainImg.style.display = 'block';
        hoverImg.style.display = 'none';
    }
};

// Funções de Super Zoom
function openSuperZoom(productId) {
    const product = allProductsLoaded.find(p => p.id === productId);
    if (!product) return;

    const images = Array.isArray(product.images) ? product.images : [];
    superZoomMediaList = images;
    currentZoomIndex = 0;
    currentModalProduct = product;

    renderSuperZoomMedia();
    document.getElementById('superZoomOverlay').style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function renderSuperZoomMedia() {
    const content = document.getElementById('superZoomContent');
    if (!content || !superZoomMediaList.length) return;

    const currentImage = superZoomMediaList[currentZoomIndex];
    const navigationHtml = superZoomMediaList.length > 1 ? `
        <button class="super-zoom-nav super-zoom-prev" onclick="changeZoom(-1)">
            <i class="fas fa-chevron-left"></i>
        </button>
        <button class="super-zoom-nav super-zoom-next" onclick="changeZoom(1)">
            <i class="fas fa-chevron-right"></i>
        </button>
    ` : '';

    const whatsappHtml = currentModalProduct ? `
        <button class="super-zoom-whatsapp" onclick="buyViaWhatsApp(${currentModalProduct.id})">
            <i class="fab fa-whatsapp"></i> Comprar Agora
        </button>
    ` : '';

    const counterHtml = superZoomMediaList.length > 1 ? 
        `<div class="super-zoom-counter">${currentZoomIndex + 1} / ${superZoomMediaList.length}</div>` : '';

    content.innerHTML = `
        ${navigationHtml}
        <div class="super-zoom-image-container">
            <img src="${currentImage}" alt="Super Zoom" style="max-width: 90vw; max-height: 90vh; object-fit: contain;">
        </div>
        ${counterHtml}
        ${whatsappHtml}
    `;
}

function changeZoom(direction) {
    if (superZoomMediaList.length <= 1) return;
    
    currentZoomIndex = (currentZoomIndex + direction + superZoomMediaList.length) % superZoomMediaList.length;
    renderSuperZoomMedia();
}

window.closeSuperZoom = function() {
    document.getElementById('superZoomOverlay').style.display = 'none';
    document.body.style.overflow = '';
    superZoomMediaList = [];
    currentZoomIndex = 0;
    currentModalProduct = null;
};

// Funções de Timer e Notificações
function startDeliveryTimer() {
    if (deliveryTimerInterval) {
        clearInterval(deliveryTimerInterval);
    }

    const endTime = new Date();
    endTime.setHours(endTime.getHours() + 3);
    endTime.setMinutes(59);
    endTime.setSeconds(59);

    deliveryTimerInterval = setInterval(() => {
        const now = new Date();
        const diff = endTime - now;

        if (diff <= 0) {
            clearInterval(deliveryTimerInterval);
            const timerElement = document.getElementById('deliveryTimer');
            if (timerElement) {
                timerElement.innerHTML = `
                    <i class="fas fa-check-circle"></i>
                    <span class="timer-text">Entrega encerrada</span>
                `;
            }
            return;
        }

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        const timeString = `${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;
        
        const timerElement = document.getElementById('deliveryTimer');
        if (timerElement) {
            timerElement.innerHTML = `
                <i class="fas fa-clock"></i>
                <span class="timer-countdown">${timeString}</span>
                <span class="timer-text">para receber hoje!</span>
            `;
        }
    }, 1000);
}

function showGeoNotification() {
    if (!allProductsLoaded.length) return;

    const detectedCity = detectedLocation.city;
    const neighborhood = detectedLocation.neighborhoods[Math.floor(Math.random() * detectedLocation.neighborhoods.length)];
    const customerName = CUSTOMER_NAMES[Math.floor(Math.random() * CUSTOMER_NAMES.length)];
    const randomProduct = allProductsLoaded[Math.floor(Math.random() * allProductsLoaded.length)];

    const notification = document.getElementById('geoNotification');
    const notificationText = document.getElementById('geoNotificationText');

    if (notification && notificationText) {
        notificationText.innerHTML = `<strong>${customerName}</strong> de <strong>${detectedCity}</strong> - <strong>${neighborhood}</strong> comprou <strong>${randomProduct.name}</strong>`;
        notification.style.display = 'block';
        setTimeout(() => notification.style.display = 'none', 8000);
    }
}

function startGeoNotifications() {
    setTimeout(showGeoNotification, 20000);
    setInterval(showGeoNotification, 20000);
}

// Funções de Mídia do Modal
function changeModalMedia(index) {
    currentMediaIndex = index;
    const mainMedia = document.getElementById('modalMainMedia');
    const thumbnails = document.querySelectorAll('.modal-thumb');
    
    if (!mainMedia || !currentMediaList[index]) return;
    
    // Atualizar mídia principal
    if (currentMediaList[index].type === 'video') {
        mainMedia.innerHTML = `<video src="${currentMediaList[index].url}" autoplay muted loop playsinline></video>`;
    } else {
        mainMedia.innerHTML = `<img src="${currentMediaList[index].url}" alt="${currentModalProduct?.name}">`;
    }
    
    // Atualizar thumbnails
    thumbnails.forEach((thumb, i) => {
        thumb.classList.toggle('active', i === index);
    });
}

function setupModalMediaClick() {
    const mainMedia = document.getElementById('modalMainMedia');
    if (!mainMedia) return;
    
    mainMedia.addEventListener('click', () => {
        if (currentMediaList[currentMediaIndex]?.type === 'image') {
            openSuperZoom(currentModalProduct?.id);
        }
    });
}

function setupModalVideoAudio(hasAudio) {
    const videos = document.querySelectorAll('#modalMainMedia video');
    videos.forEach(video => {
        if (hasAudio) {
            video.muted = false;
        } else {
            video.muted = true;
        }
    });
}

function setupNextPhotoButton() {
    const nextBtn = document.getElementById('nextPhotoBtn');
    if (!nextBtn || currentMediaList.length <= 1) {
        nextBtn.style.display = 'none';
        return;
    }
    
    nextBtn.addEventListener('click', () => {
        const nextIndex = (currentMediaIndex + 1) % currentMediaList.length;
        changeModalMedia(nextIndex);
    });
}

function renderStars(rating) {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    
    let stars = '';
    for (let i = 0; i < fullStars; i++) {
        stars += '<i class="fas fa-star"></i>';
    }
    if (hasHalfStar) {
        stars += '<i class="fas fa-star-half-alt"></i>';
    }
    for (let i = 0; i < emptyStars; i++) {
        stars += '<i class="far fa-star"></i>';
    }
    
    return stars;
}

function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function shareProduct(id) {
    const product = allProductsLoaded.find(p => p.id === id);
    if (!product) {
        showToast('Produto não encontrado para compartilhar.');
        return;
    }

    const shareData = {
        title: product.name,
        text: `Olha só essa joia incrível da Etevalda MT: ${product.name} por apenas R$ ${product.price.toFixed(2).replace('.', ',')}!`,
        url: window.location.href.split('#')[0] + `#product-${product.id}`
    };

    try {
        if (navigator.share) {
            navigator.share(shareData);
            showToast('Compartilhado com sucesso!');
        } else {
            navigator.clipboard.writeText(shareData.url);
            showToast('Link copiado para a área de transferência!');
        }
    } catch (err) {
        console.log('Compartilhamento cancelado ou erro:', err);
    }
}

// Função para renderizar o carrossel do modal
function renderModalCarousel() {
    if (!allProductsLoaded.length) return;

    // Renderiza os 3 carrosseis com produtos diferentes
    renderModalCarouselIndividual('modalInfiniteCarousel', 1);
    renderModalCarouselIndividual('modalInfiniteCarousel2', 2);
    renderModalCarouselIndividual('modalInfiniteCarousel3', 3);
}

function renderModalCarouselIndividual(carouselId, carouselIndex) {
    const modalCarousel = document.getElementById(carouselId);
    if (!modalCarousel) return;

    // Pega produtos aleatórios de TODAS as categorias (igual página principal)
    const randomProducts = [...allProductsLoaded]
        .filter(p => p.id !== currentModalProduct?.id)
        .sort(() => Math.random() - 0.5)
        .slice((carouselIndex - 1) * 8, carouselIndex * 8);

    // Se não tiver produtos suficientes, pega mais aleatórios
    if (randomProducts.length < 8) {
        const moreProducts = [...allProductsLoaded]
            .filter(p => p.id !== currentModalProduct?.id && !randomProducts.some(rp => rp.id === p.id))
            .sort(() => Math.random() - 0.5)
            .slice(0, 8 - randomProducts.length);
        randomProducts.push(...moreProducts);
    }

    // Duplica para criar o efeito infinito
    const carouselProducts = [...randomProducts, ...randomProducts];

    modalCarousel.innerHTML = carouselProducts.map(p => {
        const images = Array.isArray(p.images) ? p.images : [];
        return `
            <div class="modal-carousel-item" onclick="openProductModal(${p.id})">
                <img src="${images[0]}" alt="${p.name}" loading="lazy">
                <div class="modal-carousel-item-info">
                    <div class="modal-carousel-item-name">${p.name}</div>
                    <div class="modal-carousel-item-price">R$ ${p.price.toFixed(2).replace('.', ',')}</div>
                </div>
            </div>
        `;
    }).join('');
}

// Funções de Carrossel
function getProductsForCarousel(carouselIndex) {
    if (!allProductsLoaded.length) return [];
    
    const shuffled = [...allProductsLoaded].sort(() => Math.random() - 0.5);
    const productsPerCarousel = Math.ceil(shuffled.length / 5);
    const startIndex = (carouselIndex - 1) * productsPerCarousel;
    const endIndex = Math.min(startIndex + productsPerCarousel, shuffled.length);
    
    const carouselProducts = shuffled.slice(startIndex, endIndex);
    return [...carouselProducts, ...carouselProducts];
}

function renderCarousel(carouselId = 'infiniteCarousel', carouselIndex = 1) {
    const carousel = document.getElementById(carouselId);
    if (!carousel || !allProductsLoaded.length) return;

    const carouselProducts = getProductsForCarousel(carouselIndex);
    carousel.innerHTML = carouselProducts.map(p => {
        const images = Array.isArray(p.images) ? p.images : [];
        return `
            <div class="carousel-item" onclick="openProductModal(${p.id})">
                <img src="${images[0] || 'https://via.placeholder.com/150'}" alt="${p.name}" loading="lazy" style="aspect-ratio: 1/1; object-fit: cover;">
                <div class="carousel-item-info">
                    <div class="carousel-item-name">${p.name}</div>
                    <div class="carousel-item-price">R$ ${p.price.toFixed(2).replace('.', ',')}</div>
                </div>
            </div>
        `;
    }).join('');
}

function renderAllCarousels() {
    renderCarousel('infiniteCarousel', 1);
    renderCarousel('infiniteCarousel2', 2);
    renderCarousel('infiniteCarousel3', 3);
    renderCarousel('infiniteCarousel4', 4);
    renderCarousel('infiniteCarousel5', 5);
}

function renderSocialProof() {
    const grid = document.getElementById('socialProofGrid');
    if (!grid) return;

    if (!socialProofImages || socialProofImages.length === 0) {
        grid.innerHTML = '<p style="text-align:center;">Nenhuma imagem de prova social disponível</p>';
        return;
    }

    grid.innerHTML = socialProofImages.slice(0, 3).map(item => `
        <div class="social-proof-card">
            <div class="social-proof-image">
                <img src="${item.image_url}" alt="Prova Social" loading="lazy" style="aspect-ratio: 1/1; object-fit: cover;">
            </div>
            <div class="social-proof-overlay">
                <p class="social-proof-text">${item.caption || 'Cliente satisfeito'}</p>
            </div>
        </div>
    `).join('');
}

function renderFaqs() {
    const grid = document.getElementById('faqGrid');
    if (!grid) return;

    if (!faqs || faqs.length === 0) {
        grid.innerHTML = '<p>Nenhuma FAQ</p>';
        return;
    }

    grid.innerHTML = faqs.map(f => `
        <div class="faq-card" onclick="playFaqAudio(this)">
            <div class="faq-icon"><i class="fas fa-play"></i></div>
            <h3>${f.question}</h3>
            <div class="faq-audio">
                <audio preload="none">
                    <source src="${f.audio_url}" type="audio/mpeg">
                </audio>
            </div>
        </div>
    `).join('');
}

function showSecondarySections() {
    const sections = ['socialProofSection', 'faqSection', 'carouselSection', 'carouselSection2', 'carouselSection3', 'carouselSection4', 'carouselSection5', 'teamCarouselSection'];
    sections.forEach(id => {
        const section = document.getElementById(id);
        if (section) {
            section.style.opacity = '1';
            section.style.height = 'auto';
            section.style.overflow = 'visible';
        }
    });
    
    renderAllCarousels();
    renderSocialProof();
    renderFaqs();
}

// 5. FUNÇÕES DO MODAL
function openProductModal(id) {
    const product = allProductsLoaded.find(p => p.id === id);
    if (!product) return;

    currentModalProduct = product;
    const images = Array.isArray(product.images) ? product.images : [];
    const soldTodayHtml = product.sold_today ? '<div class="product-sold-today">Vendido Hoje</div>' : '';
    const viewersCount = Math.floor(Math.random() * 20) + 5;
    const rating = Math.floor(Math.random() * 2) + 3;

    // Criar lista de mídia para o modal
    currentMediaList = images.map((img, index) => ({
        type: 'image',
        url: img,
        thumbnail: img,
        index: index
    }));

    // Adicionar vídeos se existirem
    if (product.video_url) {
        currentMediaList.unshift({
            type: 'video',
            url: product.video_url,
            thumbnail: product.video_thumbnail || images[0] || 'https://via.placeholder.com/400',
            index: -1
        });
    }

    // Thumbnails para navegação
    const thumbnailsHtml = currentMediaList.map((media, index) => `
        <div class="modal-thumb ${media.type === 'video' ? 'video-thumb' : ''} ${index === 0 ? 'active' : ''}" onclick="changeModalMedia(${index})">
            <img src="${media.thumbnail}" alt="">
            ${index === 0 && product.badge_text ? `<span class="thumb-badge">${product.badge_text}</span>` : ''}
        </div>
    `).join('');

    const solitarioHtml = product.tem_solitario && product.solitario_price > 0 ? `
        <div class="solitario-discreto">
            <i class="fas fa-gem"></i> ${product.additional_product_name || 'Solitário'} vendido separadamente: R$ ${product.solitario_price.toFixed(2).replace('.', ',')}
        </div>
    ` : '';

    const modalHtml = `
        <div class="modal-content">
            <div class="modal-header">
                <button class="modal-close" onclick="closeProductModal()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-media-container">
                <div class="modal-main-media" id="modalMainMedia" style="position: relative;">
                    ${currentMediaList[0]?.type === 'video'
                        ? `<video src="${currentMediaList[0].url}" autoplay muted loop playsinline></video>`
                        : `<img src="${currentMediaList[0]?.url || ''}" alt="${product.name}">`}
                    ${soldTodayHtml}
                </div>
                <div class="modal-thumbnails">${thumbnailsHtml}</div>
                <button class="next-photo-btn" id="nextPhotoBtn">
                    <i class="fas fa-arrow-right"></i>
                </button>
            </div>
            <div class="modal-product-info">
                <h2>${product.name}</h2>
                <div class="modal-price">R$ ${product.price.toFixed(2).replace('.', ',')}</div>
                ${solitarioHtml}
                <div class="looking-now"><i class="fas fa-eye"></i> ${viewersCount} pessoas vendo agora</div>
                <div class="urgency-box">
                    <div class="delivery-timer" id="deliveryTimer">
                        <i class="fas fa-clock"></i>
                        <span class="timer-countdown">00h 00m 00s</span>
                        <span class="timer-text">para receber hoje!</span>
                    </div>
                </div>
                <div class="product-rating-large">${renderStars(rating)}</div>
                <div class="modal-description">${product.description || ''}</div>
                <div class="modal-buttons">
                    <button class="btn-add-cart-modal" onclick="addToCart(${product.id})">
                        <i class="fas fa-cart-plus"></i> Carrinho
                    </button>
                    <button class="btn-whatsapp-modal" aria-label="Falar com atendente no WhatsApp sobre este produto" 
                    onclick="buyViaWhatsApp(${product.id})">
                        <i class="fab fa-whatsapp"></i> WhatsApp
                    </button>
                    <button class="btn-share" onclick="shareProduct(${product.id})">
                        <i class="fas fa-share-alt"></i> <span>COMPARTILHE<br>COM SEU AMOR</span>
                    </button>
                </div>
                
                <!-- SEÇÕES SOCIAIS E RECOMENDAÇÕES -->
                <div class="modal-social-proof">
                    <h4><i class="fas fa-heart"></i> Quem viu, Gostou</h4>
                    <div class="social-likes">
                        <div class="like-item">
                            <i class="fas fa-heart"></i>
                            <span>${Math.floor(Math.random() * 50) + 20}</span>
                        </div>
                        <div class="like-item">
                            <i class="fas fa-eye"></i>
                            <span>${Math.floor(Math.random() * 100) + 50}</span>
                        </div>
                        <div class="like-item">
                            <i class="fas fa-share"></i>
                            <span>${Math.floor(Math.random() * 30) + 10}</span>
                        </div>
                    </div>
                </div>
                
                <!-- CARROSSEL DE PRODUTOS SIMILARES -->
                <div class="modal-carousel-section">
                    <div class="modal-carousel-container">
                        <div id="modalInfiniteCarousel" class="modal-infinite-carousel"></div>
                    </div>
                </div>
                <div class="modal-carousel-section">
                    <div class="modal-carousel-container">
                        <div id="modalInfiniteCarousel2" class="modal-infinite-carousel"></div>
                    </div>
                </div>
                <div class="modal-carousel-section">
                    <div class="modal-carousel-container">
                        <div id="modalInfiniteCarousel3" class="modal-infinite-carousel"></div>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.getElementById('modalContainer').innerHTML = modalHtml;
    document.getElementById('productModal').classList.add('active');
    document.body.style.overflow = 'hidden';
    
    // Iniciar timer de urgência
    startDeliveryTimer();
    
    // Configurar mídia do modal
    setupModalMediaClick();
    setupModalVideoAudio(product.video_has_audio);
    setupNextPhotoButton();
    renderModalCarousel();
    scrollToTop();
    
    // Configurar botão voltar do celular
    if (window.history.length > 1) {
        window.addEventListener('popstate', handleMobileBack);
        window.history.pushState({ modalOpen: true }, '', window.location.href);
    }
}

function closeProductModal() {
    const modal = document.getElementById('productModal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
    
    // Limpar estado do modal
    currentModalProduct = null;
    currentMediaList = [];
    currentMediaIndex = 0;
    
    // Parar timer se existir
    if (deliveryTimerInterval) {
        clearInterval(deliveryTimerInterval);
        deliveryTimerInterval = null;
    }
    
    // Garantir que o histórico do navegador funcione corretamente no mobile
    if (window.history.length > 1) {
        // Se estiver no mobile, permitir que o botão voltar do navegador funcione
        window.removeEventListener('popstate', handleMobileBack);
    }
}

function handleMobileBack(event) {
    // Fechar modal quando o usuário pressionar o botão voltar do celular
    const modal = document.getElementById('productModal');
    if (modal && modal.classList.contains('active')) {
        closeProductModal();
        event.preventDefault();
    }
}

// 6. FUNÇÕES DO CARRINHO
function addToCart(productId) {
    const product = allProductsLoaded.find(p => p.id === productId);
    if (!product) return;

    const existingItem = cart.find(item => item.id === productId);
    
    if (existingItem) {
        existingItem.quantity = (existingItem.quantity || 1) + 1;
    } else {
        cart.push({
            id: product.id,
            name: product.name,
            price: product.price,
            image: product.images?.[0] || 'https://via.placeholder.com/100',
            quantity: 1
        });
    }

    localStorage.setItem('etevalda_cart', JSON.stringify(cart));
    updateCartUI();
    showToast(`${product.name} adicionado ao carrinho!`);
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    localStorage.setItem('etevalda_cart', JSON.stringify(cart));
    updateCartUI();
}

function updateQuantity(productId, quantity) {
    const item = cart.find(item => item.id === productId);
    if (item) {
        item.quantity = Math.max(1, quantity);
        localStorage.setItem('etevalda_cart', JSON.stringify(cart));
        updateCartUI();
    }
}

function toggleCart() {
    const cartSidebar = document.getElementById('cartSidebar');
    if (cartSidebar) {
        cartSidebar.classList.toggle('active');
        document.body.style.overflow = cartSidebar.classList.contains('active') ? 'hidden' : '';
    }
}

function updateCartUI() {
    const cartItems = document.getElementById('cartItems');
    const cartCount = document.getElementById('cartCount');
    const cartTotal = document.getElementById('cartTotal');

    if (!cartItems || !cartCount || !cartTotal) return;

    if (cart.length === 0) {
        cartItems.innerHTML = '<p style="text-align:center; padding:20px;">Carrinho vazio</p>';
        cartCount.textContent = '0';
        cartTotal.textContent = 'R$ 0,00';
        return;
    }

    cartItems.innerHTML = cart.map(item => `
        <div class="cart-item">
            <img src="${item.image}" alt="${item.name}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;">
            <div class="cart-item-info">
                <h4>${item.name}</h4>
                <p>R$ ${item.price.toFixed(2).replace('.', ',')}</p>
            </div>
            <div class="cart-item-quantity">
                <button onclick="updateQuantity(${item.id}, ${item.quantity - 1})">-</button>
                <span>${item.quantity}</span>
                <button onclick="updateQuantity(${item.id}, ${item.quantity + 1})">+</button>
            </div>
            <button onclick="removeFromCart(${item.id})" style="background: var(--danger); color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">×</button>
        </div>
    `).join('');

    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    
    cartCount.textContent = itemCount;
    cartTotal.textContent = `R$ ${total.toFixed(2).replace('.', ',')}`;
}

function loadCartFromStorage() {
    const savedCart = localStorage.getItem('etevalda_cart');
    if (savedCart) {
        try {
            cart = JSON.parse(savedCart);
        } catch (error) {
            console.error('Erro ao carregar carrinho:', error);
            cart = [];
        }
    }
    updateCartUI();
}

function renderCart() {
    const cartItems = document.getElementById('cartItems');
    const cartCount = document.getElementById('cartCount');
    const cartTotal = document.getElementById('cartTotal');

    if (!cartItems || !cartCount || !cartTotal) return;

    if (cart.length === 0) {
        cartItems.innerHTML = '<p class="cart-empty">Seu carrinho está vazio</p>';
        cartCount.textContent = '0';
        cartTotal.textContent = 'R$ 0,00';
        return;
    }

    cartItems.innerHTML = cart.map(item => `
        <div class="cart-item">
            <img src="${item.image}" alt="${item.name}" class="cart-item-image">
            <div class="cart-item-details">
                <h4>${item.name}</h4>
                <div class="cart-item-price">R$ ${item.price.toFixed(2).replace('.', ',')}</div>
                <div class="cart-item-quantity">
                    <button onclick="updateQuantity(${item.id}, -1)">-</button>
                    <span>${item.quantity}</span>
                    <button onclick="updateQuantity(${item.id}, 1)">+</button>
                </div>
            </div>
            <button class="cart-item-remove" onclick="removeFromCart(${item.id})">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `).join('');

    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

    cartCount.textContent = totalItems.toString();
    cartTotal.textContent = `R$ ${total.toFixed(2).replace('.', ',')}`;
}

function loadCartFromStorage() {
    const savedCart = localStorage.getItem('etevalda_cart');
    if (savedCart) {
        try {
            cart = JSON.parse(savedCart);
        } catch (error) {
            console.error('Erro ao carregar carrinho:', error);
            cart = [];
        }
    }
    renderCart();
}

function removeFromCart(productId) {
    const index = cart.findIndex(item => item.id === productId);
    if (index > -1) {
        cart.splice(index, 1);
        localStorage.setItem('etevalda_cart', JSON.stringify(cart));
        renderCart();
        showToast('Produto removido do carrinho');
    }
}

function updateQuantity(productId, change) {
    const item = cart.find(item => item.id === productId);
    if (!item) return;

    item.quantity = Math.max(1, (item.quantity || 1) + change);
    
    if (item.quantity === 0) {
        removeFromCart(productId);
    } else {
        localStorage.setItem('etevalda_cart', JSON.stringify(cart));
        renderCart();
    }
}

function toggleCart() {
    const cartSidebar = document.getElementById('cartSidebar');
    if (cartSidebar) {
        cartSidebar.classList.toggle('active');
    }
}

function closeCart() {
    const cartSidebar = document.getElementById('cartSidebar');
    if (cartSidebar) {
        cartSidebar.classList.remove('active');
    }
}

// 7. FUNÇÕES AUXILIARES
function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('show');
    }, 100);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
}

function buyViaWhatsApp(productId) {
    const product = allProductsLoaded.find(p => p.id === productId);
    if (!product) return;

    const message = encodeURIComponent(`Olá! Gostei do produto: *${product.name}* - R$ ${product.price.toFixed(2).replace('.', ',')}. Consegue me entregar hoje?`);
    window.open(`https://api.whatsapp.com/send/?phone=5565993337205&text=${message}`, '_blank');
}

window.playFaqAudio = function(card) {
    const audio = card.querySelector('audio');
    if (audio) {
        if (audio.paused) {
            audio.play();
            card.querySelector('.faq-icon i').className = 'fas fa-stop';
        } else {
            audio.pause();
            audio.currentTime = 0;
            card.querySelector('.faq-icon i').className = 'fas fa-play';
        }
    }
};

// 8. INICIALIZAÇÃO
async function initializeApp() {
    try {
        await Promise.all([
            loadCategories(),
            loadProducts(true),
            loadFaqs(),
            loadSocialProof()
        ]);

        renderCategories();
        renderProducts();
        loadCartFromStorage();
        
        showSecondarySections();
        
        // Iniciar notificações geo-localizadas
        startGeoNotifications();

        console.log('✅ Site carregado com sucesso!');

    } catch (error) {
        console.error('❌ Erro:', error);
    }
    
    // Event Listeners para modais e carrinho
    setupModalListeners();
    setupCartListeners();
}

function setupModalListeners() {
    // Botão fechar modal
    const modalCloseBtn = document.getElementById('modalCloseBtn');
    if (modalCloseBtn) {
        modalCloseBtn.addEventListener('click', closeProductModal);
    }
    
    // Overlay do modal
    const modalOverlay = document.getElementById('modalOverlay');
    if (modalOverlay) {
        modalOverlay.addEventListener('click', closeProductModal);
    }
    
    // Botão fechar Super Zoom
    const superZoomClose = document.getElementById('superZoomClose');
    if (superZoomClose) {
        superZoomClose.addEventListener('click', closeSuperZoom);
    }
    
    // Tecla ESC para fechar modais
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const superZoom = document.getElementById('superZoomOverlay');
            const modal = document.getElementById('productModal');
            
            // Prioridade: Super Zoom > Modal
            if (superZoom && superZoom.style.display === 'flex') {
                closeSuperZoom();
            } else if (modal && modal.classList.contains('active')) {
                closeProductModal();
            }
        }
    });
}

function setupCartListeners() {
    // Botões do carrinho
    const cartBtn = document.getElementById('cartBtn');
    if (cartBtn) {
        cartBtn.addEventListener('click', toggleCart);
    }
    
    const closeCart = document.getElementById('closeCart');
    if (closeCart) {
        closeCart.addEventListener('click', () => {
            document.getElementById('cartSidebar').classList.remove('active');
            document.body.style.overflow = '';
        });
    }
    
    const cartOverlay = document.getElementById('cartOverlay');
    if (cartOverlay) {
        cartOverlay.addEventListener('click', () => {
            document.getElementById('cartSidebar').classList.remove('active');
            document.body.style.overflow = '';
        });
    }
    
    const checkoutBtn = document.getElementById('checkoutBtn');
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', () => {
            if (cart.length === 0) {
                showToast('Carrinho vazio!');
                return;
            }
            
            let message = 'Olá! Gostaria de finalizar meu pedido:\n\n';
            cart.forEach(item => {
                message += `• ${item.name} - R$ ${item.price.toFixed(2).replace('.', ',')} (Qtd: ${item.quantity})\n`;
            });
            
            const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            message += `\nTotal: R$ ${total.toFixed(2).replace('.', ',')}`;
            
            window.open(`https://api.whatsapp.com/send/?phone=5565993337205&text=${encodeURIComponent(message)}`, '_blank');
        });
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', initializeApp);

// Expor funções globais
window.openProductModal = openProductModal;
window.closeProductModal = closeProductModal;
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.updateQuantity = updateQuantity;
window.toggleCart = toggleCart;
window.closeCart = closeCart;
window.buyViaWhatsApp = buyViaWhatsApp;
window.hoverImage = hoverImage;
window.unhoverImage = unhoverImage;
window.openSuperZoom = openSuperZoom;
window.closeSuperZoom = closeSuperZoom;
window.changeZoom = changeZoom;
window.changeModalMedia = changeModalMedia;
window.shareProduct = shareProduct;
