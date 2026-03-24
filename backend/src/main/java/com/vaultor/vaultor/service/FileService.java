package com.vaultor.vaultor.service;

import com.vaultor.vaultor.model.FileEntity;
import com.vaultor.vaultor.repository.FileRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;

@Service
@RequiredArgsConstructor
public class FileService {
    private final FileRepository fileRepository;
    private final FileStorageService fileStorageService;

    public FileEntity upload(MultipartFile file) throws IOException {
        String storedName = fileStorageService.storeFile(file);
        FileEntity entity = new FileEntity();
        entity.setOriginalName(file.getOriginalFilename());
        entity.setStoredName(storedName);
        entity.setMimeType(file.getContentType());
        entity.setSize(file.getSize());
        return fileRepository.save(entity);
    }
}
