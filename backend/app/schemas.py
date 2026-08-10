from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class UserPublic(BaseModel):
    id: UUID
    email: str
    username: str
    full_name: str
    profile_picture_url: str | None = None
    account_type: str = "personal"
    business_type: str | None = None
    is_verified: bool = False

    model_config = {"from_attributes": True}


class RegisterRequest(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=50)
    full_name: str = Field(min_length=2, max_length=255)
    password: str = Field(min_length=8)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


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


class ForgotPasswordRequest(BaseModel):
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


class GroupResponse(BaseModel):
    id: UUID
    name: str
    description: str | None
    category: str | None
    creator_id: UUID
    members_count: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}


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
    description: str | None
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
    business_description: str | None = None
    business_phone: str | None = None
    business_address: str | None = None


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


class VehicleCreate(BaseModel):
    make: str = Field(min_length=1, max_length=100)
    model: str = Field(min_length=1, max_length=100)
    year: int | None = None
    trim: str | None = None
    color: str | None = None
    engine: str | None = None
    description: str | None = None
    mods: str | None = None
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
    image_urls: list[str] | None = None
    is_primary: bool | None = None


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
    image_urls: list[str] | None
    is_primary: bool
    created_at: datetime

    model_config = {"from_attributes": True}


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
