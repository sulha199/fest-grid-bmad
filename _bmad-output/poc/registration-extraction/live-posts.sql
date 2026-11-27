BEGIN READ ONLY; SET LOCAL statement_timeout='60s';
select json_build_object('id', id, 'pid', platform_post_id, 'url', post_url, 'content', content, 'image', image_url, 'durable', durable_image_url, 'addl', additional_image_urls, 'reason', grouping_reason, 'n', extracted_event_count, 'published', published_at, 'owner', owner_display_name, 'expires', image_url_expires_at, 'type', platform_post_type)
from posts where image_url_expires_at > now() + interval '30 minutes' and image_url is not null;
ROLLBACK;
