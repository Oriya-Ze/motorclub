from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

from app.schemas_media import VideoMediaResponse, ImageMediaResponse


class UserPublic(BaseModel):
    id: UUID
    email: str
    username: str
    full_name: str
    profile_picture_url: str | None = None
    account_type: str = "personal"
    business_type: str | None = None
    business_description: str | None = None
    business_phone: str | None = None
    business_address: str | None = None
    cover_image_url: str | None = None
    business_website: str | None = None
    business_registration_id: str | None = None
    business_hours: dict | None = None
    gallery_urls: list[str] | None = None
    certifications: list[str] | None = None
    service_area: dict | None = None
    is_verified: bool = False
    is_admin: bool = False
    profile_public: bool = True

    model_config = {"from_attributes": True}


class RegisterRequest(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=30)
    full_name: str = Field(min_length=2, max_length=255)
    password: str = Field(min_length=8, max_length=128)
    captcha_token: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)
    captcha_token: str | None = None


class UsernameCheckResponse(BaseModel):
    username: str
    valid: bool
    available: bool
    reason: str | None = None


class AuthResponse(BaseModel):
    user: UserPublic | None = None
    access_token: str | None = None
    token_type: str = "bearer"
    expires_in: int | None = None
    confirmation_required: bool = False
    message: str | None = None


class ConfirmSignUpRequest(BaseModel):
    email: EmailStr
    code: str = Field(min_length=1, max_length=10)
    password: str = Field(min_length=8)


class OAuthCallbackRequest(BaseModel):
    code: str = Field(min_length=1)
    redirect_uri: str = Field(min_length=1, max_length=2048)


class OAuthConfigResponse(BaseModel):
    google_enabled: bool
    client_id: str | None = None
    cognito_domain: str | None = None
    region: str | None = None
    turnstile_enabled: bool = False
    turnstile_site_key: str | None = None


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResendConfirmationRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    code: str
    new_password: str = Field(min_length=8)


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)


class PostCreate(BaseModel):
    content: str | None = None
    image_urls: list[str] | None = None
    video_urls: list[str] | None = None
    location: str | None = None
    vehicle_id: UUID | None = None
    hashtags: list[str] | None = None


class PostResponse(BaseModel):
    id: UUID
    user_id: UUID
    content: str | None
    image_urls: list[str] | None
    video_urls: list[str] | None
    video_media: list[VideoMediaResponse] | None = None
    image_media: list[ImageMediaResponse] | None = None
    location: str | None
    vehicle_id: UUID | None = None
    hashtags: list[str] | None = None
    created_at: datetime
    author: UserPublic
    likes_count: int = 0
    comments_count: int = 0
    is_liked: bool = False
    is_saved: bool = False

    model_config = {"from_attributes": True}


class CommentCreate(BaseModel):
    content: str = Field(min_length=1)


class CommentResponse(BaseModel):
    id: UUID
    post_id: UUID
    user_id: UUID
    content: str
    created_at: datetime
    author: UserPublic

    model_config = {"from_attributes": True}


class GroupCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    description: str | None = None
    category: str | None = None
    privacy: str = Field(default="public", pattern="^(public|closed)$")


class GroupResponse(BaseModel):
    id: UUID
    name: str
    description: str | None
    category: str | None
    privacy: str = "public"
    creator_id: UUID
    members_count: int = 0
    is_member: bool = False
    my_status: str | None = None
    my_role: str | None = None
    can_manage: bool = False
    pending_count: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}


class FollowStatusResponse(BaseModel):
    following: bool
    status: str


class FollowRequestResponse(BaseModel):
    user_id: UUID
    created_at: datetime
    user: UserPublic


class GroupMemberResponse(BaseModel):
    user_id: UUID
    role: str
    joined_at: datetime
    user: UserPublic

    model_config = {"from_attributes": True}


class GroupMemberRoleUpdate(BaseModel):
    role: str = Field(pattern="^(member|admin)$")


class GroupMessageCreate(BaseModel):
    content: str | None = None
    image_url: str | None = None
    video_url: str | None = None


class GroupMessageResponse(BaseModel):
    id: UUID
    group_id: UUID
    user_id: UUID
    content: str | None
    image_url: str | None
    video_url: str | None
    created_at: datetime
    author: UserPublic

    model_config = {"from_attributes": True}


class ForumResponse(BaseModel):
    id: UUID
    name: str
    name_en: str | None = None
    description: str | None
    description_en: str | None = None
    icon: str | None
    topics_count: int

    model_config = {"from_attributes": True}


class ForumTopicCreate(BaseModel):
    forum_id: UUID
    title: str = Field(min_length=3, max_length=500)
    content: str = Field(min_length=1)


class ForumTopicResponse(BaseModel):
    id: UUID
    forum_id: UUID
    user_id: UUID
    title: str
    content: str
    is_pinned: bool
    is_solved: bool
    views_count: int
    replies_count: int = 0
    created_at: datetime
    author: UserPublic

    model_config = {"from_attributes": True}


class ForumReplyCreate(BaseModel):
    content: str = Field(min_length=1)


class ForumReplyResponse(BaseModel):
    id: UUID
    topic_id: UUID
    user_id: UUID
    content: str
    is_best_answer: bool
    created_at: datetime
    author: UserPublic

    model_config = {"from_attributes": True}


class EventCreate(BaseModel):
    title: str = Field(min_length=2, max_length=255)
    description: str | None = None
    event_type: str = "meetup"
    location: str | None = None
    event_date: datetime
    event_end_date: datetime | None = None
    max_participants: int | None = None
    image_url: str | None = None


class EventResponse(BaseModel):
    id: UUID
    creator_id: UUID
    title: str
    description: str | None
    event_type: str
    location: str | None
    event_date: datetime
    event_end_date: datetime | None
    max_participants: int | None
    image_url: str | None
    participants_count: int = 0
    is_joined: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}


class ProductCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    description: str | None = None
    price: float = Field(gt=0)
    category: str = "other"
    image_urls: list[str] | None = None


class ProductUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=255)
    description: str | None = None
    price: float | None = Field(default=None, gt=0)
    category: str | None = None
    image_urls: list[str] | None = None


class ProductResponse(BaseModel):
    id: UUID
    business_id: UUID
    name: str
    description: str | None
    price: float
    category: str
    image_urls: list[str] | None
    created_at: datetime
    seller: UserPublic | None = None

    model_config = {"from_attributes": True}


class ProfileUpdate(BaseModel):
    full_name: str | None = None
    username: str | None = None
    profile_picture_url: str | None = None
    cover_image_url: str | None = None
    business_type: str | None = None
    business_description: str | None = None
    business_phone: str | None = None
    business_address: str | None = None
    business_website: str | None = None
    business_registration_id: str | None = None
    business_hours: dict | None = None
    gallery_urls: list[str] | None = None
    certifications: list[str] | None = None
    service_area: dict | None = None


class SettingsUpdate(BaseModel):
    profile_public: bool | None = None
    show_posts: bool | None = None
    show_groups: bool | None = None
    post_notifications: bool | None = None
    comment_notifications: bool | None = None
    event_notifications: bool | None = None
    email_notifications: bool | None = None
    theme: str | None = None
    language: str | None = None


class SettingsResponse(BaseModel):
    profile_public: bool
    show_posts: bool
    show_groups: bool
    post_notifications: bool
    comment_notifications: bool
    event_notifications: bool
    email_notifications: bool
    theme: str
    language: str

    model_config = {"from_attributes": True}


class MessageResponse(BaseModel):
    id: UUID
    conversation_id: UUID
    sender_id: UUID
    content: str | None
    image_url: str | None
    video_url: str | None
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class VehicleModShop(BaseModel):
    id: UUID
    full_name: str
    username: str | None = None
    account_type: str | None = None
    business_type: str | None = None
    profile_picture_url: str | None = None


class VehicleModItem(BaseModel):
    id: str | None = None
    category: str = "other"
    name: str = Field(min_length=1, max_length=120)
    brand: str | None = Field(default=None, max_length=80)
    shop_id: UUID | None = None
    shop: VehicleModShop | None = None


class VehicleCreate(BaseModel):
    make: str = Field(min_length=1, max_length=100)
    model: str = Field(min_length=1, max_length=100)
    year: int | None = None
    trim: str | None = None
    color: str | None = None
    engine: str | None = None
    description: str | None = None
    mods: str | None = None
    nickname: str | None = Field(default=None, max_length=40)
    walkaround_url: str | None = None
    sound_url: str | None = None
    mod_items: list[VehicleModItem] | None = None
    image_urls: list[str] | None = None
    is_primary: bool = False


class VehicleUpdate(BaseModel):
    make: str | None = None
    model: str | None = None
    year: int | None = None
    trim: str | None = None
    color: str | None = None
    engine: str | None = None
    description: str | None = None
    mods: str | None = None
    nickname: str | None = Field(default=None, max_length=40)
    walkaround_url: str | None = None
    sound_url: str | None = None
    mod_items: list[VehicleModItem] | None = None
    image_urls: list[str] | None = None
    is_primary: bool | None = None


class VehicleCatalogMake(BaseModel):
    id: str
    name: str


class VehicleCatalogModel(BaseModel):
    id: str
    name: str
    code: str


class VehicleCatalogVariant(BaseModel):
    id: str
    trim: str
    engine: str
    fuel: str | None = None
    engine_cc: int | None = None
    horsepower: int | None = None
    year_from: int | None = None
    year_to: int | None = None


class VehicleResponse(BaseModel):
    id: UUID
    user_id: UUID
    make: str
    model: str
    year: int | None
    trim: str | None
    color: str | None
    engine: str | None
    description: str | None
    mods: str | None
    nickname: str | None = None
    walkaround_url: str | None = None
    sound_url: str | None = None
    mod_items: list[VehicleModItem] | None = None
    image_urls: list[str] | None
    is_primary: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class VehicleDetailResponse(VehicleResponse):
    owner: UserPublic
    follower_count: int = 0
    is_following: bool = False
    spot_count: int = 0
    has_spotted: bool = False


class VehicleFollowResponse(BaseModel):
    following: bool
    follower_count: int


class VehicleSpotResponse(BaseModel):
    spotted: bool
    spot_count: int


class BusinessTaggedWork(BaseModel):
    vehicle_id: UUID
    title: str
    catalog: str
    image_url: str | None = None
    mod_name: str
    mod_category: str
    owner_name: str | None = None


class NotificationResponse(BaseModel):
    id: UUID
    user_id: UUID
    actor_id: UUID | None
    type: str
    title: str
    body: str | None
    link: str | None
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class StoryCreate(BaseModel):
    media_url: str
    media_type: str = "image"
    caption: str | None = None


class StoryResponse(BaseModel):
    id: UUID
    user_id: UUID
    media_url: str
    media_type: str
    caption: str | None
    expires_at: datetime
    created_at: datetime
    author: UserPublic

    model_config = {"from_attributes": True}


class BusinessUpgradeRequestCreate(BaseModel):
    business_name: str = Field(min_length=2, max_length=255)
    business_type: str = Field(min_length=2, max_length=50)
    business_phone: str = Field(min_length=7, max_length=30)
    business_address: str = Field(min_length=3, max_length=500)
    business_description: str = Field(min_length=10, max_length=2000)
    contact_full_name: str = Field(min_length=2, max_length=255)
    contact_phone: str = Field(min_length=7, max_length=30)
    business_registration_id: str | None = Field(default=None, max_length=50)
    business_website: str | None = Field(default=None, max_length=500)
    additional_notes: str | None = Field(default=None, max_length=2000)


class BusinessUpgradeRequestResponse(BaseModel):
    id: UUID
    user_id: UUID
    status: str
    business_name: str | None
    business_type: str | None
    business_description: str | None
    business_phone: str | None
    business_address: str | None
    business_registration_id: str | None
    business_website: str | None
    contact_full_name: str | None
    contact_phone: str | None
    additional_notes: str | None
    rejection_reason: str | None
    created_at: datetime
    reviewed_at: datetime | None

    model_config = {"from_attributes": True}


class BusinessUpgradeRequestAdminResponse(BusinessUpgradeRequestResponse):
    applicant_email: str
    applicant_username: str
    admin_notes: str | None


class BusinessUpgradeRejectBody(BaseModel):
    rejection_reason: str = Field(min_length=3, max_length=1000)
    admin_notes: str | None = Field(default=None, max_length=2000)


class BusinessUpgradeApproveBody(BaseModel):
    admin_notes: str | None = Field(default=None, max_length=2000)


class BusinessServiceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    price_from: float | None = Field(default=None, ge=0)
    duration_minutes: int | None = Field(default=None, ge=1, le=24 * 60)
    sort_order: int = 0
    is_active: bool = True


class BusinessServiceUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    price_from: float | None = Field(default=None, ge=0)
    duration_minutes: int | None = Field(default=None, ge=1, le=24 * 60)
    sort_order: int | None = None
    is_active: bool | None = None


class BusinessServiceResponse(BaseModel):
    id: UUID
    business_id: UUID
    name: str
    description: str | None
    price_from: float | None
    duration_minutes: int | None
    sort_order: int
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class BusinessReviewCreate(BaseModel):
    rating: int = Field(ge=1, le=5)
    text: str | None = Field(default=None, max_length=2000)


class BusinessReviewResponse(BaseModel):
    id: UUID
    business_id: UUID
    rating: int
    text: str | None
    created_at: datetime
    reviewer: UserPublic | None = None


class BusinessViewCreate(BaseModel):
    event_type: str = Field(min_length=1, max_length=30)


class BusinessAnalyticsResponse(BaseModel):
    period_days: int
    views: int
    call_clicks: int
    navigate_clicks: int
    whatsapp_clicks: int
    share_clicks: int
    rating_avg: float | None
    review_count: int
