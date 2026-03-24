package com.vaultor.vaultor.controller;

import com.vaultor.vaultor.model.FileEntity;
import com.vaultor.vaultor.repository.FileRepository;
import com.vaultor.vaultor.service.FileService;
import com.vaultor.vaultor.service.FileStorageService;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;
import java.nio.file.Path;

@RestController
@RequestMapping("/api/files")
@RequiredArgsConstructor
public class FileController {
    private final FileService fileService;
    private final FileRepository fileRepository;
    private final FileStorageService fileStorageService;

    @PostMapping
    public ResponseEntity<?> uploadFile(@RequestParam("file") MultipartFile file) {
        try {
            FileEntity entity = fileService.upload(file);
            return ResponseEntity.ok(java.util.Map.of(
                "id", entity.getId(),
                "name", entity.getOriginalName()
            ));
        } catch (IOException e) {
            return ResponseEntity.internalServerError().body(e.getMessage());
        }
    }

    @GetMapping("/{id}/download")
    public ResponseEntity<Resource> downloadFile(@PathVariable String id) {
        return fileRepository.findById(id).map(f -> {
            try {
                Path path = fileStorageService.getFile(f.getStoredName());
                Resource resource = new UrlResource(path.toUri());
                return ResponseEntity.ok()
                        .contentType(MediaType.parseMediaType(f.getMimeType() != null ? f.getMimeType() : "application/octet-stream"))
                        .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + f.getOriginalName() + "\"")
                        .body(resource);
            } catch (Exception e) {
                return ResponseEntity.internalServerError().<Resource>build();
            }
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteFile(@PathVariable String id) {
        return fileRepository.findById(id).map(f -> {
            try {
                fileStorageService.deleteFile(f.getStoredName());
                fileRepository.delete(f);
                return ResponseEntity.noContent().<Void>build();
            } catch (IOException e) {
                return ResponseEntity.internalServerError().<Void>build();
            }
        }).orElse(ResponseEntity.notFound().build());
    }
}
