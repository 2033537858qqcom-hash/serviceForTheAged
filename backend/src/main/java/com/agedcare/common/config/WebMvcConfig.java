package com.agedcare.common.config;

import com.agedcare.common.security.AuthInterceptor;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import com.agedcare.modules.serviceitem.service.ServiceImageStorage;

import java.nio.file.Path;

@Configuration
@RequiredArgsConstructor
public class WebMvcConfig implements WebMvcConfigurer {

    private final AuthInterceptor authInterceptor;
    private final ServiceImageStorage serviceImageStorage;

    @Value("${app.upload-fallback-dir:./uploads/fallback}")
    private String fallbackDir;

    @Value("${app.cors.allowed-origins:http://localhost:5173,http://127.0.0.1:5173,http://localhost:8080}")
    private String[] allowedOrigins;

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/media/service-images/**")
                .addResourceLocations(serviceImageStorage.resourceLocation(), "classpath:/static/service-images/")
                .setCachePeriod(3600);

        Path fallbackPath = Path.of(fallbackDir).toAbsolutePath().normalize();
        String fallbackUri = fallbackPath.toUri().toString();
        if (!fallbackUri.endsWith("/")) {
            fallbackUri += "/";
        }
        registry.addResourceHandler("/media/fallback/**")
                .addResourceLocations(fallbackUri)
                .setCachePeriod(3600);
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(authInterceptor)
                .addPathPatterns("/**")
                .excludePathPatterns(
                        "/auth/login",
                        "/auth/register",
                        "/auth/wechat-login",
                        "/auth/mock-login",
                        "/service-items/list-available",
                        "/media/**",
                        "/swagger-ui/**",
                        "/swagger-ui.html",
                        "/v3/api-docs/**",
                        "/doc.html",
                        "/webjars/**",
                        "/error"
                );
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOriginPatterns(allowedOrigins)
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH")
                .allowedHeaders("*")
                .allowCredentials(false)
                .maxAge(3600);
    }
}
