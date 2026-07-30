DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'product_type') THEN CREATE TYPE public.product_type AS ENUM (
    'STOCK',
    'NON_STOCK',
    'SERVICES'
); END IF; END $$;
--> statement-breakpoint

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stock_movement_type') THEN CREATE TYPE public.stock_movement_type AS ENUM (
    'sale',
    'restock',
    'adjustment',
    'waste',
    'return',
    'initial'
); END IF; END $$;
--> statement-breakpoint

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tax_type') THEN CREATE TYPE public.tax_type AS ENUM (
    'inclusive',
    'exclusive',
    'none'
); END IF; END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS public.add_ons (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    price numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS public.cashier_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    outlet_id uuid NOT NULL,
    cashier_id uuid NOT NULL,
    cashier_name character varying(100) NOT NULL,
    status character varying(20) DEFAULT 'OPEN'::character varying NOT NULL,
    opened_at timestamp without time zone DEFAULT now() NOT NULL,
    closed_at timestamp without time zone,
    starting_cash numeric(12,2) DEFAULT 0 NOT NULL,
    ending_cash numeric(12,2),
    expected_cash numeric(12,2),
    cash_difference numeric(12,2),
    payment_breakdown jsonb DEFAULT '{}'::jsonb,
    total_refunds numeric(12,2) DEFAULT 0,
    total_orders_count integer DEFAULT 0,
    closed_by uuid,
    force_closed_reason text,
    notes text,
    closing_notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    settings_snapshot jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS public.categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS public.customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    phone character varying(30) NOT NULL,
    email character varying(100),
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS public.floor_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    outlet_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    width integer DEFAULT 1200,
    height integer DEFAULT 800,
    grid_size integer DEFAULT 40,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS public.loyalty_coupon_usages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    coupon_id uuid NOT NULL,
    order_id uuid NOT NULL,
    member_id uuid,
    discount_amount numeric(12,2) NOT NULL,
    used_at timestamp without time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS public.loyalty_coupons (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    program_id uuid,
    code character varying(50) NOT NULL,
    type character varying(30) NOT NULL,
    value numeric(12,2) NOT NULL,
    max_discount numeric(12,2),
    product_id uuid,
    min_purchase numeric(12,2),
    usage_limit integer,
    used_count integer DEFAULT 0 NOT NULL,
    valid_from timestamp without time zone,
    valid_until timestamp without time zone,
    is_active boolean DEFAULT true NOT NULL,
    is_single_use boolean DEFAULT false NOT NULL,
    member_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS public.loyalty_member_programs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    member_id uuid NOT NULL,
    program_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS public.loyalty_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS public.loyalty_points_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    member_id uuid NOT NULL,
    program_id uuid NOT NULL,
    order_id uuid,
    outlet_id uuid NOT NULL,
    points integer NOT NULL,
    type character varying(10) NOT NULL,
    expires_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS public.loyalty_programs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    points_per_unit integer DEFAULT 1 NOT NULL,
    unit_amount integer DEFAULT 1000 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS public.loyalty_reward_redemptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reward_id uuid NOT NULL,
    member_id uuid NOT NULL,
    order_id uuid,
    program_id uuid NOT NULL,
    points_cost integer NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    claimed_at timestamp without time zone,
    cancelled_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS public.loyalty_rewards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    program_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    type character varying(30) NOT NULL,
    points_cost integer NOT NULL,
    value numeric(12,2) NOT NULL,
    max_discount numeric(12,2),
    product_id uuid,
    stock integer,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS public.modifier_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    selection_type character varying(20) DEFAULT 'single'::character varying NOT NULL,
    min_select integer DEFAULT 0 NOT NULL,
    max_select integer,
    is_required boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS public.modifiers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    price_adjustment numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS public.order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    product_id uuid NOT NULL,
    quantity integer NOT NULL,
    price numeric NOT NULL,
    subtotal numeric NOT NULL,
    product_name character varying(255),
    notes text
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS public.orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    idempotency_key text NOT NULL,
    outlet_id uuid NOT NULL,
    total_amount numeric NOT NULL,
    status text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    subtotal numeric NOT NULL,
    tax_amount numeric DEFAULT '0'::numeric NOT NULL,
    discount_amount numeric DEFAULT '0'::numeric NOT NULL,
    payment_method text NOT NULL,
    amount_paid numeric NOT NULL,
    change_amount numeric NOT NULL,
    table_number character varying(10),
    cashier_id uuid,
    cashier_name text,
    order_number character varying(50),
    rounding_amount numeric DEFAULT '0'::numeric NOT NULL,
    member_id uuid,
    coupon_id uuid,
    redeemed_reward_id uuid,
    session_id uuid
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS public.outlet_add_ons (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    outlet_id uuid NOT NULL,
    add_on_id uuid NOT NULL,
    price numeric(12,2),
    stock integer,
    is_available boolean DEFAULT true NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS public.outlet_loyalty_programs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    outlet_id uuid NOT NULL,
    program_id uuid NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS public.outlet_modifiers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    outlet_id uuid NOT NULL,
    modifier_id uuid NOT NULL,
    price_adjustment numeric(12,2),
    is_available boolean DEFAULT true NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS public.outlet_products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    outlet_id uuid NOT NULL,
    product_id uuid NOT NULL,
    stock integer DEFAULT 0 NOT NULL,
    sell_price_override numeric(12,2),
    low_stock_threshold integer,
    is_available boolean DEFAULT true NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    variant_id uuid
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS public.outlet_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    outlet_id uuid NOT NULL,
    store_name_override character varying(100),
    store_address_override text,
    store_phone_override character varying(30),
    receipt_footer_override text,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    timezone_override character varying(50),
    currency_override character varying(10),
    date_format_override character varying(20),
    time_format_override character varying(10),
    allow_selling_below_cost_override boolean,
    allow_negative_stock_override boolean,
    require_customer_override boolean,
    auto_generate_order_number_override boolean,
    order_numbering_format_override character varying(50),
    rounding_method_override character varying(20),
    decimal_precision_override integer,
    payment_methods_override jsonb,
    order_sequence_reset_override character varying(10),
    default_tax_rate_override numeric(5,2),
    tax_type_override character varying(10),
    active_floor_plan_ids jsonb,
    promotion_tax_mode_override character varying(10)
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS public.outlets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    address text,
    phone character varying(30),
    business_mode text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    is_custom_config boolean DEFAULT false NOT NULL,
    code character varying(20),
    email character varying(100),
    logo_url text
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS public.product_add_ons (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    add_on_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS public.product_variants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    price numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    sku character varying(64),
    is_default boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS public.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sku character varying(64) NOT NULL,
    barcode character varying(64),
    name character varying(255) NOT NULL,
    cost_price numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    sell_price numeric(12,2) NOT NULL,
    tax_type public.tax_type DEFAULT 'none'::public.tax_type NOT NULL,
    tax_rate numeric(5,2),
    track_stock boolean,
    unit character varying(32) DEFAULT 'pcs'::character varying NOT NULL,
    low_stock_threshold integer,
    allow_negative_stock boolean,
    category_id uuid,
    is_active boolean DEFAULT true NOT NULL,
    image_url text,
    created_by uuid,
    updated_by uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    is_global boolean DEFAULT true NOT NULL,
    type public.product_type DEFAULT 'STOCK'::public.product_type NOT NULL,
    has_variants boolean DEFAULT false NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS public.promotion_outlets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    promotion_id uuid NOT NULL,
    outlet_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS public.promotion_programs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    promotion_type character varying(20) NOT NULL,
    type character varying(20) NOT NULL,
    value numeric(12,2) NOT NULL,
    max_discount numeric(12,2),
    product_id uuid,
    min_purchase numeric(12,2),
    valid_from timestamp without time zone,
    valid_until timestamp without time zone,
    is_active boolean DEFAULT true NOT NULL,
    buy_qty integer,
    get_qty integer,
    code character varying(50),
    usage_limit integer,
    used_count integer DEFAULT 0 NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS public.refresh_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token_hash text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS refresh_tokens_user_id_unique ON public.refresh_tokens USING btree (user_id);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS public.stock_movements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    outlet_id uuid NOT NULL,
    product_id uuid NOT NULL,
    type public.stock_movement_type NOT NULL,
    quantity_change integer NOT NULL,
    stock_after integer NOT NULL,
    reference_id uuid,
    note character varying(255),
    reason character varying(255),
    created_by uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    variant_id uuid
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS public.tables (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    floor_plan_id uuid NOT NULL,
    number character varying(10) NOT NULL,
    capacity integer DEFAULT 4,
    shape character varying(20) DEFAULT 'circle'::character varying,
    pos_x integer DEFAULT 0,
    pos_y integer DEFAULT 0,
    width integer DEFAULT 80,
    height integer DEFAULT 80,
    status character varying(20) DEFAULT 'Empty'::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS public.tenant_settings (
    id text DEFAULT 'default'::text NOT NULL,
    store_name character varying(100) NOT NULL,
    store_address text,
    store_phone character varying(30),
    default_tax_rate numeric(5,2) DEFAULT '0'::numeric,
    tax_type public.tax_type DEFAULT 'none'::public.tax_type,
    receipt_footer text,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    timezone character varying(50) DEFAULT 'Asia/Jakarta'::character varying,
    currency character varying(10) DEFAULT 'IDR'::character varying,
    date_format character varying(20) DEFAULT 'DD/MM/YYYY'::character varying,
    time_format character varying(10) DEFAULT 'HH:mm'::character varying,
    allow_selling_below_cost boolean DEFAULT false,
    allow_negative_stock boolean DEFAULT false,
    require_customer boolean DEFAULT false,
    auto_generate_order_number boolean DEFAULT true,
    order_numbering_format character varying(50) DEFAULT '{OUTLET}-{YYYYMMDD}-{SEQ}'::character varying,
    rounding_method character varying(20) DEFAULT 'nearest_100'::character varying,
    decimal_precision integer DEFAULT 0,
    payment_methods jsonb,
    order_sequence_reset character varying(10) DEFAULT 'daily'::character varying,
    promotion_tax_mode character varying(10) DEFAULT 'after_tax'::character varying
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS public.user_outlets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    outlet_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    role text NOT NULL,
    name text NOT NULL,
    email text,
    password_hash text,
    pin_hash text,
    is_active boolean DEFAULT true NOT NULL,
    is_all_outlets boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS add_ons_name_unique ON public.add_ons USING btree (name);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS customers_phone_unique ON public.customers USING btree (phone);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_cashier_sessions_outlet_status ON public.cashier_sessions USING btree (outlet_id, status);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS idx_one_open_session_per_cashier_outlet ON public.cashier_sessions USING btree (outlet_id, cashier_id) WHERE ((status)::text = 'OPEN'::text);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON public.refresh_tokens USING btree (token_hash);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS loyalty_member_programs_unique ON public.loyalty_member_programs USING btree (member_id, program_id);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS outlet_add_ons_unique ON public.outlet_add_ons USING btree (outlet_id, add_on_id);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS outlet_loyalty_programs_unique ON public.outlet_loyalty_programs USING btree (outlet_id, program_id);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS outlet_modifiers_unique ON public.outlet_modifiers USING btree (outlet_id, modifier_id);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS outlet_products_unique ON public.outlet_products USING btree (outlet_id, product_id, variant_id);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS outlets_code_unique ON public.outlets USING btree (code);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS product_add_ons_unique ON public.product_add_ons USING btree (product_id, add_on_id);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS products_barcode_unique ON public.products USING btree (barcode);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS products_sku_unique ON public.products USING btree (sku);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS promotion_outlets_unique ON public.promotion_outlets USING btree (promotion_id, outlet_id);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS user_outlets_unique ON public.user_outlets USING btree (user_id, outlet_id);
--> statement-breakpoint
