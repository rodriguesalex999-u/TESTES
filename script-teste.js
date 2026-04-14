const SUPABASE_URL = 'https://vnrfmsyanrvqqhmqyixk.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_xGLDFQarl-DhshRW0932FQ_asug0TUK';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let allProductsLoaded = [];

async function loadProducts() {
    const container = document.getElementById('productsContainer');
    container.innerHTML = 'Carregando produtos...';
    
    try {
        const { data, error } = await _supabase.from('products').select('*');
        
        if (error) {
            container.innerHTML = 'Erro: ' + error.message;
            return;
        }
        
        if (!data || data.length === 0) {
            container.innerHTML = 'Nenhum produto encontrado';
            return;
        }
        
        allProductsLoaded = data;
        
        container.innerHTML = allProductsLoaded.map(p => {
            let primeiraImagem = '';
            if (Array.isArray(p.images) && p.images.length > 0) {
                primeiraImagem = p.images[0];
            } else if (typeof p.images === 'string') {
                primeiraImagem = p.images;
            } else {
                primeiraImagem = 'https://via.placeholder.com/200';
            }
            
            return `
                <div class="product-card">
                    <img src="${primeiraImagem}" alt="${p.name}">
                    <h3>${p.name}</h3>
                    <p class="product-price">R$ ${p.price.toFixed(2).replace('.', ',')}</p>
                </div>
            `;
        }).join('');
        
    } catch (err) {
        container.innerHTML = 'Erro: ' + err.message;
    }
}

loadProducts();